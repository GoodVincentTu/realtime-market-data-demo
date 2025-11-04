 
import React from "react";
import { createBrowserRouter } from "react-router-dom";
import Root from "./Root";
import ErrorBoundary from "./components/ErrorBoundary";
import Dashboard from "./pages/Dashboard";
import Health from "./pages/Health";
import Symbols from "./pages/Symbols";

const router = createBrowserRouter([
  {
    path: "/",
    element: React.createElement(Root),
    errorElement: React.createElement(ErrorBoundary),
    children: [
      { index: true, element: React.createElement(Dashboard) },
      { path: "symbols", element: React.createElement(Symbols) },
      { path: "health", element: React.createElement(Health) }
    ]
  }
]);

export default router;