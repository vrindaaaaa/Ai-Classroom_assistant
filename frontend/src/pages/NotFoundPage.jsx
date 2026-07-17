import { Link } from "react-router-dom";

function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
      <h1 className="text-6xl font-bold text-indigo-600">404</h1>
      <p className="mt-4 text-xl text-gray-700">Page Not Found</p>
      <Link
        to="/"
        className="mt-6 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition"
      >
        Go to Home
      </Link>
    </div>
  );
}

export default NotFoundPage;
