import React from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

function HomePage() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background">
      <h1 className="mb-4 text-4xl font-bold text-foreground">
        Daily Rituals
      </h1>
      <p className="mb-8 text-muted-foreground">
        Build better habits, one day at a time.
      </p>
      <Button onClick={() => navigate('/habits')}>View Habits</Button>
    </div>
  );
}

function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <h1 className="text-2xl font-bold text-foreground">Login</h1>
    </div>
  );
}

function HabitsPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background p-8">
      <h1 className="mb-4 text-2xl font-bold text-foreground">Habits</h1>
      <Button onClick={() => navigate('/habits/new')}>New Habit</Button>
    </div>
  );
}

function NewHabitPage() {
  return (
    <div className="min-h-screen bg-background p-8">
      <h1 className="text-2xl font-bold text-foreground">New Habit</h1>
    </div>
  );
}

function HabitDetailPage() {
  return (
    <div className="min-h-screen bg-background p-8">
      <h1 className="text-2xl font-bold text-foreground">Habit Detail</h1>
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
