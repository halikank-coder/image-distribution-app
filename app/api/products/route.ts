import { NextRequest, NextResponse } from 'next/server';
import { getAllProducts, upsertProduct, deleteProduct } from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {
    try {
        const products = await getAllProducts();
        return NextResponse.json({ products });
    } catch (err) {
        console.error(err);
        return NextResponse.json({ error: 'データ取得に失敗しました' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const sku = formData.get('sku') as string;
        const name = formData.get('name') as string;
        const file = formData.get('image') as File | null;

        if (!sku) {
            return NextResponse.json({ error: 'SKUは必須です' }, { status: 400 });
        }

        let image_path = (formData.get('existing_image') as string) || '';

        if (file && file.size > 0) {
            // Supabase Storageにアップロード
            const ext = file.name.split('.').pop();
            const filename = `products/${sku.replace(/[^a-zA-Z0-9_-]/g, '_')}.${ext}`;
            const buffer = Buffer.from(await file.arrayBuffer());

            const { error: storageError } = await supabaseAdmin.storage
                .from('product-images')
                .upload(filename, buffer, {
                    contentType: file.type,
                    upsert: true,
                });

            if (storageError) {
                console.error('Storage error:', storageError);
                return NextResponse.json({ error: '画像のアップロードに失敗しました' }, { status: 500 });
            }

            const { data: urlData } = supabaseAdmin.storage
                .from('product-images')
                .getPublicUrl(filename);
            image_path = urlData.publicUrl;
        }

        await upsertProduct({ sku, name: name || sku, image_path });
        return NextResponse.json({ success: true });
    } catch (err) {
        console.error(err);
        return NextResponse.json({ error: '保存に失敗しました' }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const sku = searchParams.get('sku');
    if (!sku) return NextResponse.json({ error: 'SKUが必要です' }, { status: 400 });
    try {
        await deleteProduct(sku);
        return NextResponse.json({ success: true });
    } catch (err) {
        console.error(err);
        return NextResponse.json({ error: '削除に失敗しました' }, { status: 500 });
    }
}
