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

    const mailOptions = {
      from: `"シラハナ フラワー" <${process.env.SMTP_USER || 'info@sirahana.com'}>`,
      to: customer_email,
      subject: '【重要】ご注文商品の画像を添付しております（シラハナフラワー）',
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
    
    <p style="margin:0 0 20px;font-weight:bold;">【重要】この度はご注文いただき誠にありがとうございます。</p>
    
    <p style="margin:0 0 20px;">
      ご注文番号: <strong>${order_number}</strong><br>
      商品の画像を添付しておりますのでご確認ください。
    </p>

    const imagesToDisplay = image_paths && image_paths.length > 0 ? image_paths : (image_path ? [image_path] : []);

    const imageSection = imagesToDisplay.map((url: string) => `
        < div style="margin:20px 0;text-align:center;" >
        <img src="${url}" alt = "ご注文商品" style="max-width:100%;border-radius:8px;box-shadow:0 2px 10px rgba(0,0,0,0.1);margin-bottom:10px;" >
        </div>
          `).join('');

    <p style="margin:0 0 20px;">
      よろしければ、簡単で構いませんので、率直な感想や使用感などの【商品レビュー】を書いて頂けると幸いです。<br>
      実際に購入、ご使用されたお客様のコメントは、これから商品の購入を検討される多くのお客様にとってなによりの参考になります。<br>
      また、至らぬ点などは今後の商品の改善や品質の向上にも役立たせて頂きます。
    </p>

    <p style="margin:0 0 10px;text-align:center;font-weight:bold;">
      ↓こちらのリンクより、すぐにお書き頂けます↓
    </p>
    <div style="text-align:center;margin:0 0 30px;">
      <a href="https://www.amazon.co.jp/gp/your-account/order-history/ref=nav_youraccount_jp_ab_ya_ad_yo" 
         style="display:inline-block;background:#f78fb3;color:#fff;text-decoration:none;padding:12px 30px;border-radius:4px;font-weight:bold;">
        Amazonで購入履歴を確認・レビューを書く
      </a>
    </div>

    <p style="margin:0 0 20px;">
      何か到着した商品に不備や問題などありましたら、可能な限りの対応をさせて頂きますので、メールよりご連絡をお待ちしております。
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
