import iconv from 'iconv-lite';

export type ParsedOrder = {
    order_number: string;
    goq_number: string;
    ship_date: string;
    delivery_date: string;
    customer_email: string;
    customer_name: string;
    recipient_name: string;
    gift_message: string;
    product_sku: string;
    status: 'pending';
    notes: string;
};

function parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current);
    return result;
}

function extractGiftMessage(remarks: string): string {
    const match = remarks.match(/ギフトメッセージ\n([\s\S]*?)(?=$)/);
    return match ? match[1].trim() : '';
}

export function parseOrderCsv(buffer: Buffer): ParsedOrder[] {
    // Try ShiftJIS first, then UTF-8
    let text: string;
    try {
        text = iconv.decode(buffer, 'Shift_JIS');
        // Quick check: if we see garbage, fallback to UTF-8
        if (text.includes('ï»¿') || !text.includes('受注番号')) {
            text = buffer.toString('utf-8');
        }
    } catch {
        text = buffer.toString('utf-8');
    }

    const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    if (lines.length < 2) return [];

    // Skip header row
    const dataLines: string[] = [];
    let i = 1;
    while (i < lines.length) {
        let row = lines[i];
        if (!row.trim()) { i++; continue; }

        // Count quotes to detect multi-line fields
        let quoteCount = (row.match(/"/g) || []).length;
        while (quoteCount % 2 !== 0 && i + 1 < lines.length) {
            i++;
            row += '\n' + lines[i];
            quoteCount = (row.match(/"/g) || []).length;
        }
        dataLines.push(row);
        i++;
    }

    const orders: ParsedOrder[] = [];
    for (const line of dataLines) {
        const cols = parseCSVLine(line);
        if (cols.length < 11) continue;

        const order_number = cols[0].trim();
        if (!order_number) continue;

        const remarks = cols[9] || '';
        const gift_message = extractGiftMessage(remarks);

        orders.push({
            order_number,
            goq_number: cols[1]?.trim() || '',
            ship_date: cols[3]?.trim() || '',
            delivery_date: cols[4]?.trim() || '',
            customer_email: cols[6]?.trim() || '',
            customer_name: cols[7]?.trim() || '',
            recipient_name: cols[8]?.trim() || '',
            gift_message,
            product_sku: cols[10]?.trim() || '',
            status: 'pending',
            notes: '',
        });
    }
    return orders;
}
