import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { ProblemMaterial } from '../api/problemFetchClient.js';
import type { TaskLayoutPaths } from '../workspace/directoryLayout.js';

export async function writeProblemMaterial(
  layout: TaskLayoutPaths,
  material: ProblemMaterial,
): Promise<void> {
  const samplesDir = path.join(layout.problemDir, 'samples');

  await mkdir(samplesDir, { recursive: true });
  await Promise.all([
    rm(layout.statementMarkdownPath, { force: true }),
    rm(layout.statementHtmlPath, { force: true }),
  ]);

  const writes: Promise<unknown>[] = [
    writeFile(path.join(layout.problemDir, 'title.txt'), material.title, 'utf8'),
    writeFile(
      layout.problemMetadataPath,
      JSON.stringify(
        {
          title: material.title,
          samples: material.samples,
          limits: material.limits,
          raw: material.raw,
          pageSnapshotUrl: material.pageSnapshotUrl,
        },
        null,
        2,
      ),
      'utf8',
    ),
  ];

  if (material.statementMarkdown) {
    writes.push(writeFile(layout.statementMarkdownPath, material.statementMarkdown, 'utf8'));
  }

  if (material.statementHtml) {
    writes.push(writeFile(layout.statementHtmlPath, material.statementHtml, 'utf8'));
  }

  if (material.pageSnapshotHtml) {
    writes.push(writeFile(path.join(layout.problemDir, 'page.snapshot.html'), material.pageSnapshotHtml, 'utf8'));
  }

  for (const [index, sample] of material.samples.entries()) {
    const sampleId = String(index + 1).padStart(2, '0');
    writes.push(
      writeFile(path.join(samplesDir, `sample-${sampleId}.input.txt`), sample.input, 'utf8'),
      writeFile(path.join(samplesDir, `sample-${sampleId}.output.txt`), sample.output, 'utf8'),
    );
  }

  await Promise.all(writes);
}
