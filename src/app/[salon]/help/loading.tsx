import { SkeletonBlocks } from '@/app/Skeleton';

export default function Loading() {
  return <main style={{ padding: '24px 20px', maxWidth: 900, margin: '0 auto' }}><SkeletonBlocks rows={5} /></main>;
}
