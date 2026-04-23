import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import axios from "axios";
import { apiUrl } from "../api";

function Panel({ title, children }) {
  return (
    <div className="panel-card p-6">
      <h3 className="text-lg font-semibold text-green-900">{title}</h3>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function Badge({ children, tone = "green" }) {
  const tones = {
    green: "bg-green-100 text-green-800",
    amber: "bg-amber-100 text-amber-800",
    blue: "bg-sky-100 text-sky-800",
  };
  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${tones[tone]}`}>{children}</span>;
}

export default function CropPlanning() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchPlanning = async () => {
      try {
        const token = localStorage.getItem("token");
        const response = await axios.get(apiUrl("/api/crop-planning/overview"), {
          headers: { Authorization: `Bearer ${token}` },
        });
        setData(response.data);
      } catch (err) {
        setError("Failed to load crop planning data");
      } finally {
        setLoading(false);
      }
    };

    fetchPlanning();
  }, []);

  if (loading) return <div className="empty-panel">Loading crop planning...</div>;
  if (error) return <div className="empty-panel text-red-600">{error}</div>;
  if (!data?.fields?.length) return <div className="empty-panel">Add a field first to generate crop recommendations and rotation plans.</div>;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="section-shell">
      <div className="section-hero">
        <div>
          <h2 className="section-title">🧭 Crop Planning</h2>
          <p className="section-copy">
            Crop recommendations are ranked from your soil, irrigation, season, and crop history. Rotation guidance avoids repeating the same crop and favors soil-restoring options.
          </p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-slate-500">Planning coverage</p>
          <p className="mt-3 text-3xl font-bold text-green-900">{data.fields.length}</p>
          <p className="mt-2 text-sm text-slate-600">Generated from your saved fields.</p>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="Top Crop Recommendations">
          <div className="space-y-4">
            {data.recommendations.map((item) => (
              <div key={item.fieldId} className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">{item.fieldName || item.cropName}</p>
                    <p className="text-sm text-slate-600">{item.village}, {item.district}</p>
                  </div>
                  <Badge tone="green">Current: {item.cropName || "--"}</Badge>
                </div>
                <div className="mt-4 space-y-3">
                  {item.recommendations.map((rec) => (
                    <div key={rec.crop} className="rounded-2xl bg-white px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-semibold text-slate-900">{rec.crop}</p>
                        <Badge tone={rec.score >= 70 ? "green" : rec.score >= 55 ? "amber" : "blue"}>{rec.score}/100</Badge>
                      </div>
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
                        {rec.reasons.map((reason) => <li key={reason}>{reason}</li>)}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Crop Rotation Plan">
          <div className="space-y-4">
            {data.rotationPlans.map((plan) => (
              <div key={plan.fieldId} className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                <p className="font-semibold text-slate-900">{plan.fieldName || plan.cropName}</p>
                <p className="text-sm text-slate-600">{plan.village}, {plan.district}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge tone="blue">Current: {plan.currentCrop}</Badge>
                  <Badge tone="amber">Last seen: {plan.lastCrop}</Badge>
                </div>
                <div className="mt-4">
                  <p className="text-sm font-semibold text-slate-800">Next crop options</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {plan.nextCropOptions.map((crop) => <Badge key={crop}>{crop}</Badge>)}
                  </div>
                </div>
                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-600">
                  {plan.notes.map((note) => <li key={note}>{note}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </motion.div>
  );
}
