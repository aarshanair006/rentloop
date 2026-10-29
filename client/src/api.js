// One small helper used by every page to call the backend with fetch.
// It adds the login token (if any) and turns error responses into thrown errors.
// Set VITE_API_URL in client/.env when the backend runs somewhere else (see .env.example).
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

// Same list as CATEGORIES in server/models.js
export const CATEGORIES = ["Electronics", "Cameras", "Vehicles", "Books", "Fashion", "Sports"];

// Shows a saved date like "26 Oct 2026". Dates are saved at midnight UTC, so we print them in UTC too.
export function formatDate(dateValue) {
  return new Date(dateValue).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

export async function callApi(path, method = "GET", body = null) {
  const options = { method: method, headers: { "Content-Type": "application/json" } };

  const token = localStorage.getItem("token");
  if (token) {
    options.headers.Authorization = "Bearer " + token;
  }
  if (body) {
    options.body = JSON.stringify(body);
  }

  // If the backend is not running, fetch fails before we get any answer
  let response;
  try {
    response = await fetch(API_URL + path, options);
  } catch (networkError) {
    throw new Error("Cannot reach the server. Is the backend running?");
  }

  // Our API always answers with JSON, but a proxy or hosting error page might not
  let result = {};
  try {
    result = await response.json();
  } catch (parseError) {
    // not JSON: keep the empty object and use the status code below
  }

  // The server sends { message } when something went wrong
  if (!response.ok) {
    throw new Error(result.message || "Something went wrong (error " + response.status + ")");
  }
  return result.data;
}
