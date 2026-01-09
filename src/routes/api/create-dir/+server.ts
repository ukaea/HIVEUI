import { error, json, type RequestHandler } from "@sveltejs/kit";
import { mkdir, readdir, stat } from 'fs/promises'; // Added stat
import { join } from "path";


async function createProcessedDir(processedDir: string) {
  try {
      const stats = await stat(processedDir);
      if (!stats.isDirectory()) {
        await mkdir(processedDir, { recursive: true });
      }

      const entries = await readdir(processedDir, {withFileTypes: true});
      
      const seqDirs = entries.filter((e) => e.isDirectory() && e.name.startsWith('seq'))
                  .map((e) => e.name);

      if (seqDirs.length === 0) {
        const newSeqDir = 'seq1';
        if (stats.isDirectory()) {
          const newSeqPath = join(processedDir, newSeqDir)
          await mkdir(newSeqPath, { recursive: true });
          return newSeqPath;
        }
      }
      const seqNumbers = seqDirs.map((name) => Number(name.slice(3)))
                  .filter((n) => !Number.isNaN(n));
      const maxSeq = Math.max(...seqNumbers);
      const nextSeqNum = maxSeq + 1;
      const newSeqPath = join(processedDir, `seq${nextSeqNum}`);

      await mkdir(newSeqPath, { recursive: true });
      return newSeqPath
    } catch (err: any) {

  }
}

export const POST: RequestHandler = async ({ request }) => {
    const { targetPath } = await request.json();

    if (!targetPath) {
        throw error(400, 'Pulse Dir is required');
    }

    try {
        if (!targetPath.endsWith("processed/")){
              throw error(400, 'Target path must end with "processed"');
        }
        
        const createdSeqDir = await createProcessedDir(targetPath);
        console.log("This is seq directory", createdSeqDir)
        return json({ createdSeqDir });
    } catch(err: any) {
        if (err.status) throw err;
        console.error(err);
        throw error(500, err.message);
    }
};

