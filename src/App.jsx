import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/layout';
import ToastContainer from './components/common/ToastContainer';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard';
import Projects from './pages/Projects';
import ProjectNew from './pages/ProjectNew';
import ProjectBoard from './pages/ProjectBoard';
import ProjectSettings from './pages/ProjectSettings';
import TeamManagement from './pages/TeamManagement';
import Activity from './pages/Activity';
import MyTasks from './pages/MyTasks';
import MySubtasks from './pages/MySubtasks';
import Analytics from './pages/Analytics';
import Calendar from './pages/Calendar';
import UserManagement from './pages/UserManagement';
import Notifications from './pages/Notifications';
import Settings from './pages/Settings';

import './App.css';

function App() {
  return (
    <Router>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* Protected routes */}
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="projects" element={<Projects />} />
          <Route path="projects/new" element={<ProjectNew />} />
          <Route path="projects/:projectId/board" element={<ProjectBoard />} />
          <Route path="projects/:projectId/list" element={<ProjectBoard />} />
          <Route path="projects/:projectId/settings" element={<ProjectSettings />} />
          <Route path="projects/:projectId/team" element={<TeamManagement />} />
          <Route path="tasks" element={<MyTasks />} />
          <Route path="my-subtasks" element={<MySubtasks />} />
          <Route path="calendar" element={<Calendar />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="activity" element={<Activity />} />
          <Route path="admin/users" element={<UserManagement />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="settings" element={<Settings />} />
        </Route>

        {/* Catch all */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>

      {/* Global Toast Container for auth pages */}
      <ToastContainer />
    </Router>
  );
}

export default App;
