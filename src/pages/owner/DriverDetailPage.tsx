import { useParams } from 'react-router-dom';

export default function DriverDetailPage() {
  const { id } = useParams();
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <h1 className="text-2xl font-semibold text-white">Driver Detail</h1>
      <p className="mt-2 text-gray-400">ID: {id}</p>
    </div>
  );
}
