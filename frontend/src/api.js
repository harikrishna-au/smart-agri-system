const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || (window.location.hostname === "localhost" ? "http://localhost:5312" : "https://smart-agri-system-6v1s.onrender.com");
export function apiUrl(path) {
  return `${API_BASE_URL}${path}`;
}

export function assetUrl(path) {
  return `${API_BASE_URL}${path}`;
}

export { API_BASE_URL };

// ML function
export async function predictCrop(data) {
  try {
    const response = await fetch(`${API_BASE_URL}/predict-crop`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    return await response.json();
  } catch (error) {
    console.error("Prediction error:", error);
    return null;
  }
}