import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { updateOrderStatus } from '@/lib/db';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'sv16707.xserver.jp',
  port: Number(process.env.SMTP_PORT) || 465,
  secure: true, // SSL
  auth: {
    user: process.env.SMTP_USER || 'info@sirahana.com',
    pass: process.env.SMTP_PASS,
  },
});

export async function POST(req: NextRequest) {
  try {
    // SMTP接続の事前確認
    try {
      await transporter.verify();
      console.log('SMTP connection verified');
    } catch (verifyError: any) {
      console.error('SMTP Verify Error:', verifyError);
      return NextResponse.json({
        error: `SMTP接続エラー: ${verifyError.message}`,
        details: '認証情報またはサーバー設定を確認してください'
      }, { status: 500 });
    }

    const body = await req.json();
    const { order_number, customer_email, customer_name, recipient_name, product_sku, image_path, image_paths } = body;

    if (!order_number || !customer_email) {
      return NextResponse.json({ error: '必須パラメータが不足しています' }, { status: 400 });
    }

    const recipientDisplay = recipient_name && recipient_name !== customer_name
      ? `${recipient_name}様（ご注文者: ${customer_name}様）`
      : `${customer_name}様`;

    const imagesToDisplay = image_paths && image_paths.length > 0 ? image_paths : (image_path ? [image_path] : []);

    const imageSection = imagesToDisplay.map((url: string) => `
    <div style="margin:20px 0;text-align:center;">
      <img src="${url}" alt="ご注文商品" style="max-width:100%;border-radius:8px;box-shadow:0 2px 10px rgba(0,0,0,0.1);margin-bottom:10px;">
    </div>
    `).join('');

    const mailOptions = {
      from: `"シラハナ フラワー" <${process.env.SMTP_USER || 'info@sirahana.com'}>`,
      to: customer_email,
      subject: `【白坂花店】お届けするお花の画像をご用意いたしました（ご注文番号：${order_number}）`,
      html: `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:20px;background:#fff;font-family:'Hiragino Sans','Meiryo',sans-serif;color:#333;line-height:1.8;">
  <div style="max-width:600px;margin:0 auto;border:1px solid #eee;padding:30px;border-radius:8px;">
    <p style="margin:0 0 20px;">${customer_name} 様</p>
    
    <p style="margin:0 0 20px;">
      この度は、数あるショップの中から白坂花店にてご注文いただき、誠にありがとうございます。
    </p>

    <p style="margin:0 0 20px;">
      本日、お客様よりご注文いただきましたお花の発送手配が完了いたしました。<br>
      大切な贈り物として、またご自宅用としてお選びいただいたお花が、どのような状態でお手元（またはお届け先）に向かっているのかご確認いただけるよう、実際に制作したお写真を添付してお送りいたします。
    </p>

    <p style="margin:0 0 20px;font-weight:bold;">
      ぜひ、添付の画像にて実物のお花をご覧くださいませ。
    </p>

    <div style="margin:30px 0;padding:20px;background:#f9f9f9;border-radius:8px;">
      <p style="margin:0 0 10px;font-weight:bold;">【お客様へのお願い】</p>
      <p style="margin:0;font-size:14px;">
        当店では、お客様からのお声（商品レビュー）を何よりの励みとし、今後のデザインや品質向上のための大切な参考とさせていただいております。<br><br>
        もしよろしければ、お花が無事に到着いたしましたら、Amazonの「注文履歴」より、率直なご感想をお聞かせいただけますと大変嬉しく存じます。<br>
        お客様のリアルなお声が、これからお花選びをされる多くの方にとって一番の参考となります。
      </p>
    </div>

    <p style="margin:0 0 20px;">
      商品の到着まで、今しばらくお待ちくださいませ。<br>
      この度は白坂花店をご利用いただき、心より感謝申し上げます。
    </p>

    <hr style="border:0;border-top:1px solid #eee;margin:30px 0;">
    <p style="margin:0;font-size:14px;color:#333;line-height:1.6;">
      白坂花店<br>
      住所：香川県高松市宮脇町2丁目29-5<br>
      Email: info@sirahana.com
    </p>
  </div>
</body>
</html>
      `.trim(),
      attachments: imagesToDisplay.map((url: string, index: number) => ({
        filename: `flower_${index + 1}.jpg`,
        path: url,
        cid: `flower_image_${index}` // HTML内で <img src="cid:..." /> を使う場合用
      }))
    };

    await transporter.sendMail(mailOptions);
    console.log('Mail sent successfully to:', customer_email);

    // ステータスを「送信済」に自動更新
    await updateOrderStatus(order_number, 'sent');

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Mail send error details:', err);
    return NextResponse.json({
      error: `メール送信失敗: ${err.message || '不明なエラー'}`,
      details: err.code || err.command
    }, { status: 500 });
  }
}
