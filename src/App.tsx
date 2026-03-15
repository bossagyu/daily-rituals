import React from 'react';
import { Routes, Route, Link } from 'react-router-dom';

function HomePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50">
      <h1 className="mb-4 text-4xl font-bold text-gray-900">Daily Rituals</h1>
      <p className="mb-8 text-gray-600">
        Build better habits, one day at a time.
      </p>
      <Link
        to="/habits"
        className="rounded-lg bg-blue-600 px-6 py-3 text-white transition-colors hover:bg-blue-700"
      >
        View Habits
      </Link>
    </div>
  );
}

function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <h1 className="text-2xl font-bold text-gray-900">Login</h1>
    </div>
  );
}

function HabitsPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <h1 className="mb-4 text-2xl font-bold text-gray-900">Habits</h1>
      <Link
        to="/habits/new"
        className="rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700"
      >
        New Habit
      </Link>
    </div>
  );
}

function NewHabitPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <h1 className="text-2xl font-bold text-gray-900">New Habit</h1>
    </div>
  );
}

function HabitDetailPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <h1 className="text-2xl font-bold text-gray-900">Habit Detail</h1>
    </div>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/habits" element={<HabitsPage />} />
      <Route path="/habits/new" element={<NewHabitPage />} />
      <Route path="/habits/:id" element={<HabitDetailPage />} />
    </Routes>
  );
}
