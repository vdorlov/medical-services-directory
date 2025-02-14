export class CompressionService {
    static async compress(data) {
        const jsonString = JSON.stringify(data);
        const uint8Array = new TextEncoder().encode(jsonString);
        const compressed = await new Promise((resolve) => {
            const cs = new CompressionStream('gzip');
            const writer = cs.writable.getWriter();
            writer.write(uint8Array);
            writer.close();
            const reader = cs.readable.getReader();
            const chunks = [];
            reader.read().then(function process({done, value}) {
                if (done) {
                    resolve(new Blob(chunks));
                    return;
                }
                chunks.push(value);
                return reader.read().then(process);
            });
        });
        return compressed;
    }

    static async decompress(blob) {
        const ds = new DecompressionStream('gzip');
        const writer = ds.writable.getWriter();
        writer.write(await blob.arrayBuffer());
        writer.close();
        const reader = ds.readable.getReader();
        const chunks = [];
        while (true) {
            const {done, value} = await reader.read();
            if (done) break;
            chunks.push(value);
        }
        const uint8Array = new Uint8Array(chunks.reduce((acc, val) => acc + val.length, 0));
        let offset = 0;
        for (const chunk of chunks) {
            uint8Array.set(chunk, offset);
            offset += chunk.length;
        }
        return JSON.parse(new TextDecoder().decode(uint8Array));
    }
} 