import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db';
import { getOrderImages, addOrderImage } from '@/lib/db';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const order_number = searchParams.get('order_number');

    if (!order_number) {
        return NextResponse.json({ error: 'order_number is required' }, { status: 400 });
    }

    try {
        const images = await getOrderImages(order_number);
        return NextResponse.json({ success: true, images });
    } catch (err) {
        console.error('Fetch order images error:', err);
        return NextResponse.json({ error: 'Failed to fetch images' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const order_number = formData.get('order_number') as string;
        const imageFile = formData.get('image') as File;

        if (!order_number || !imageFile) {
            return NextResponse.json({ error: 'Order number and image are required' }, { status: 400 });
        }

        // 1. Upload to Supabase Storage
        const fileExt = imageFile.name.split('.').pop();
        const fileName = `${order_number}_${Date.now()}.${fileExt}`;
        const filePath = `orders/${order_number}/${fileName}`;
        const buffer = Buffer.from(await imageFile.arrayBuffer());

        const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
            .from('product-images')
            .upload(filePath, buffer, {
                contentType: imageFile.type,
                upsert: true
            });

        if (uploadError) {
            console.error('Supabase Storage Upload Error:', uploadError);
            throw uploadError;
        }

        // 2. Get Public URL
        const { data: { publicUrl } } = supabaseAdmin.storage
            .from('product-images')
            .getPublicUrl(filePath);

        // 3. Save to order_images table
        const newImage = await addOrderImage(order_number, publicUrl);

        return NextResponse.json({ success: true, image: newImage });
    } catch (err: any) {
        console.error('Order image upload error:', err);
        return NextResponse.json({ error: `Upload failed: ${err.message || 'Unknown error'}` }, { status: 500 });
    }
}
