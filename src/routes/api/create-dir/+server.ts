import { env } from "$env/dynamic/private";
import { error, json, type RequestHandler } from "@sveltejs/kit";
import { mkdir, readdir, stat, writeFile } from 'fs/promises'; // Added stat
import { join, normalize, relative, resolve } from "path";


async function createProcessedDir(processedDir: string) {
  try {
      await mkdir(processedDir, { recursive: true });

      const stats = await stat(processedDir)

      if (!stats.isDirectory()) {
        throw new Error(`${processedDir} directory path was not created!`)
      }
    
      const entries = await readdir(processedDir, {withFileTypes: true});
      
      const seqDirs = entries.filter((e) => e.isDirectory() && e.name.startsWith('seq'))
                  .map((e) => e.name);

      if (seqDirs.length === 0) {
        const newSeqPath = join(processedDir, "seq1")
        await mkdir(newSeqPath, { recursive: true });
        return newSeqPath;
      }
      const seqNumbers = seqDirs.map((name) => Number(name.slice(3)))
                  .filter((n) => !Number.isNaN(n));
      const nextSeqNum = Math.max(...seqNumbers) + 1;
      const newSeqPath = join(processedDir, `seq${nextSeqNum}`);

      await mkdir(newSeqPath, { recursive: true });
      
      return json({
          success: true,
          message: 'Process directory created',
          path: newSeqPath
      });

    } catch (err: any) {
        if (err.status) throw err;
        console.error(err);
        throw error(500, err.message);
  }
}

export const POST: RequestHandler = async ({ request }) => {
    const body = await request.json();
    const { experimentNumber, sampleNumber, pulseNumber, metadata } = body;

    if (!experimentNumber || !sampleNumber || !pulseNumber || !metadata) {
        throw error(400, 'experiment number, sample number and pulse number are required.');
    };

    try {
        const rootFolder = env.ROOT_FOLDER_LOCATION;
        if (!rootFolder) {
          throw new Error('ROOT_FOLDER_LOCATION is not set in environment variables');
        }
        const experimentDir = `E-${experimentNumber}`;
        const sampleDir = `S-${sampleNumber}`;
        const pulseDir = `P-${pulseNumber}`;
        const relativePath = `HIVE/${experimentDir}/${sampleDir}/${pulseDir}/processed/`

        const sanitizedPath = normalize(relativePath).replace(/^(\.\.[\/\\])+/, '');
        const fullPath = resolve(rootFolder, sanitizedPath);

        // Security check: ensure we are still within the root folder
        if (!fullPath.startsWith(resolve(rootFolder))) {
          throw error(403, 'Access denied: Invalid file path');
        }
        
        const createdSeqDir = await createProcessedDir(fullPath);

        // this part will be removed when linked to airflow
        await writeFile(join(createdSeqDir, 'processed-metadata.json'), JSON.stringify(metadata, null, 2));

        const relativeSeqPath = join("/local/", relative(rootFolder, createdSeqDir))
        
        return json({
            success: true,
            message: 'Processed directory created',
            path: relativeSeqPath
        });

    } catch(err: any) {
        if (err.status) throw err;
        console.error(err);
        throw error(500, err.message);
    }
};

