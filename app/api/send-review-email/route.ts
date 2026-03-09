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
      subject: '【シラハナフラワー】ご注文商品の発送前のご報告（お写真付き）',
      html: `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:20px;background:#fff;font-family:'Hiragino Sans','Meiryo',sans-serif;color:#333;line-height:1.8;">
  <div style="max-width:600px;margin:0 auto;border:1px solid #eee;padding:30px;border-radius:8px;">
    <p style="margin:0 0 20px;">${recipientDisplay}</p>
    
    <p style="margin:0 0 20px;font-weight:bold;">この度はシラハナフラワーへのご注文、誠にありがとうございます。</p>
    
    <p style="margin:0 0 20px;">
      ご注文いただきました商品（受注番号: ${order_number}）の発送準備が整いました。<br>
      実際にお届けするお花の状態を事前にご確認いただけるよう、撮影したお写真を本メールに添付いたしました。
    </p>

    <div style="margin:20px 0;text-align:center;color:#666;font-size:14px;">
      （※お写真は本メールの添付ファイルとしてもご確認いただけます）
    </div>

    <p style="margin:0 0 20px;">
      お届けまで今しばらくお待ちくださいませ。<br>
      何か到着した商品に不備や問題などありましたら、お手数ですが本メールへの返信にてご連絡をいただけますと幸いです。
    </p>

    <hr style="border:0;border-top:1px solid #eee;margin:30px 0;">
    <p style="margin:0;font-size:12px;color:#888;text-align:center;">
      シラハナフラワー<br>
      info@sirahana.com
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

    // ステータスを「レビュー依頼済」に自動更新
    await updateOrderStatus(order_number, 'review_requested');

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Mail send error:', err);
    return NextResponse.json({ error: 'メール送信に失敗しました' }, { status: 500 });
  }
}
