"use client";

import Link from "next/link";
import { ShieldAlert } from "lucide-react";

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="max-w-md w-full text-center space-y-6 bg-white dark:bg-gray-800 p-8 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="mx-auto w-16 h-16 bg-red-100 dark:bg-red-900/30 flex items-center justify-center rounded-full text-red-600 dark:text-red-400">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight mb-2">Unauthorized Access</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            You do not have the required Super Admin privileges to view the Recommendation Control Center.
          </p>
        </div>
        <div className="pt-4">
          <Link
            href="/login"
            className="inline-flex justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-gray-900 hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100 transition-colors"
          >
            Return to Login
          </Link>
        </div>
      </div>
    </div>
  );
}
