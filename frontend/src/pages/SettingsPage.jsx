import React, { useState, useEffect } from "react";
import { User, Shield, Moon, Sun, Monitor, Bell } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import Card from "../components/Card";
import PageHeader from "../components/PageHeader";
import Button from "../components/Button";

export default function SettingsPage() {
  const { user, loading } = useAuth();
  const { addToast } = useToast();

  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("theme") === "dark");

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [darkMode]);

  const handleSaveTheme = () => {
    addToast("UI Theme preferences updated", "success");
  };

  return (
    <div className="space-y-6">
      
      {/* Page Header */}
      <PageHeader
        title="Settings"
        description="Manage your account profile, study settings, and dashboard interface theme."
      />

      <div className="grid gap-6 md:grid-cols-2 items-start">
        
        {/* Profile Card */}
        <Card title="Account Profile" subtitle="Your profile details registered in Educareer AI">
          {loading ? (
            <div className="space-y-4">
              <div className="h-10 w-full animate-pulse bg-slate-100 rounded-lg" />
              <div className="h-10 w-full animate-pulse bg-slate-100 rounded-lg" />
            </div>
          ) : !user ? (
            <p className="text-sm text-slate-500 py-4">No active user profile information found.</p>
          ) : (
            <div className="space-y-4">
              
              {/* Profile details */}
              <div className="flex items-center gap-4 p-4 rounded-xl border border-slate-100 bg-slate-50/50">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 text-white font-bold text-lg">
                  {user.name ? user.name[0].toUpperCase() : <User size={20} />}
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-base">{user.name}</h4>
                  <p className="text-xs text-slate-500">{user.email}</p>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <div className="flex justify-between text-sm py-2 border-b border-slate-100">
                  <span className="text-slate-500 font-medium flex items-center gap-1.5">
                    <Shield size={16} /> User Role
                  </span>
                  <span className="font-semibold text-slate-900 uppercase text-xs tracking-wider bg-slate-100 px-2 py-0.5 rounded">
                    {user.role || "student"}
                  </span>
                </div>
                <div className="flex justify-between text-sm py-2 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">Joined Date</span>
                  <span className="font-semibold text-slate-900">
                    {user.created_at ? new Date(user.created_at).toLocaleDateString() : "N/A"}
                  </span>
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* Display Settings */}
        <Card title="Interface Settings" subtitle="Toggle dashboard visuals and UI preferences">
          <div className="space-y-4">
            
            {/* Dark Mode toggle bar */}
            <div className="flex items-center justify-between p-4 rounded-xl border border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-white border border-slate-100 text-slate-600">
                  {darkMode ? <Moon size={18} /> : <Sun size={18} />}
                </div>
                <div>
                  <h5 className="font-bold text-sm text-slate-950">Dark Mode</h5>
                  <p className="text-xs text-slate-500">Toggle dark style sheets</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDarkMode(!darkMode)}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  darkMode ? "bg-indigo-600" : "bg-slate-200"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    darkMode ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            <Button
              variant="primary"
              onClick={handleSaveTheme}
              className="w-full justify-center"
            >
              Save Preferences
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
