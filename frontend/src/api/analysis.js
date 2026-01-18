export async function analyzeBBox(bbox) {
  const res = await fetch("http://127.0.0.1:8000/analyze", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(bbox),
  });

  if (!res.ok) {
    throw new Error("Backend error");
  }

  return res.json();
}