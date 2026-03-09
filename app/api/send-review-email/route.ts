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
        const { order_number, customer_email, customer_name, recipient_name, product_sku } = body;

        if (!order_number || !customer_email) {
            return NextResponse.json({ error: '必須パラメータが不足しています' }, { status: 400 });
        }

        const recipientDisplay = recipient_name && recipient_name !== customer_name
            ? `${recipient_name}様（ご注文者: ${customer_name}様）`
            : `${customer_name}様`;

        const mailOptions = {
            from: `"シラハナ フラワー" <${process.env.SMTP_USER || 'info@sirahana.com'}>`,
            to: customer_email,
            subject: '商品はいかがでしたか？レビューをお願いします🌸',
            html: `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#f9f9f9;font-family:'Hiragino Sans','Meiryo',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f9f9;padding:30px 0;">
    <tr>
      <td align="center">
        <table width="580" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
          
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#f8a5c2,#f78fb3);padding:32px;text-align:center;">
              <p style="margin:0;font-size:28px;">🌸</p>
              <h1 style="margin:8px 0 0;color:#fff;font-size:20px;font-weight:700;">
                ご購入ありがとうございました
              </h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 40px;">
              <p style="margin:0 0 16px;color:#333;font-size:15px;line-height:1.8;">
                ${recipientDisplay}
              </p>
              <p style="margin:0 0 16px;color:#333;font-size:15px;line-height:1.8;">
                この度はシラハナフラワーをご利用いただき、誠にありがとうございます。
              </p>
              <p style="margin:0 0 24px;color:#333;font-size:15px;line-height:1.8;">
                商品（${product_sku}）はいかがでしたでしょうか？<br>
                よろしければ、Amazonにてレビューをいただけますと大変嬉しく、励みになります。
              </p>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:16px 0 24px;">
                    <a href="https://www.amazon.co.jp/review/create-review"
                      style="display:inline-block;background:linear-gradient(135deg,#f8a5c2,#f78fb3);color:#fff;text-decoration:none;padding:14px 36px;border-radius:999px;font-size:15px;font-weight:700;letter-spacing:0.5px;">
                      🌟 Amazonでレビューを書く
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 8px;color:#888;font-size:13px;line-height:1.8;">
                ※ レビューは任意です。ご多忙の中、もしよろしければで構いません。
              </p>
              <p style="margin:0;color:#888;font-size:13px;line-height:1.8;">
                また何かご不明点がございましたら、いつでもお気軽にご連絡ください。<br>
                今後ともシラハナフラワーをよろしくお願いいたします。
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#fef6f8;padding:20px 40px;text-align:center;border-top:1px solid #fde8ed;">
              <p style="margin:0;color:#aaa;font-size:12px;">
                シラハナフラワー / info@sirahana.com
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
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
