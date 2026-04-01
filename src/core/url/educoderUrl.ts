export interface EducoderCollectionUrl {
  courseId: string;
  categoryId: string;
}

const ALLOWED_HOSTS = new Set(['www.educoder.net', 'educoder.net']);

export function parseEducoderCollectionUrl(raw: string): EducoderCollectionUrl {
  let parsed: URL;

  try {
    parsed = new URL(raw);
  } catch {
    throw new Error('Invalid Educoder collection URL');
  }

  if (parsed.protocol !== 'https:' || !ALLOWED_HOSTS.has(parsed.hostname)) {
    throw new Error('Invalid Educoder collection URL');
  }

  const segments = parsed.pathname.split('/').filter(Boolean);
  if (segments.length !== 4) {
    throw new Error('Invalid Educoder collection URL');
  }

  const [classrooms, courseId, shixunHomework, categoryId] = segments;
  if (
    classrooms !== 'classrooms' ||
    shixunHomework !== 'shixun_homework' ||
    !courseId ||
    !categoryId
  ) {
    throw new Error('Invalid Educoder collection URL');
  }

  return { courseId, categoryId };
}
