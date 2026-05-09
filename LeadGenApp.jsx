import { useEffect, useRef, useState } from "react";

const PRESET_COUNTS = [10, 50, 100, 200, 500, 1000];
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

const STATUS = {
  IDLE: "idle",
  RUNNING: "running",
  DONE: "done",
  ERROR: "error",
};

function generateMockLead(query, i) {
  const cities = {
    mumbai: "Mumbai",
    delhi: "Delhi",
    bangalore: "Bengaluru",
    pune: "Pune",
    hyderabad: "Hyderabad",
  };
  const city =
    Object.entries(cities).find(([k]) => query.toLowerCase().includes(k))?.[1] ||
    "Mumbai";
  const types = query.toLowerCase().includes("gym")
    ? [
        "FitZone",
        "PowerHouse",
        "IronClub",
        "FlexFit",
        "EliteGym",
        "ProFit",
        "StrongBody",
        "GoldGym",
        "MaxFit",
        "CoreZone",
      ]
    : query.toLowerCase().includes("restaurant")
      ? [
          "SpicyKitchen",
          "TasteOfIndia",
          "FoodCourt",
          "GourmetHaven",
          "BiryaniHouse",
          "MasalaBox",
          "FlavourHut",
          "DesiDhaba",
          "RoyalThali",
          "FoodNation",
        ]
      : [
          "AcmeCorp",
          "TechSolutions",
          "PrimeServices",
          "EliteGroup",
          "ProBusiness",
          "TopBrand",
          "BestChoice",
          "SmartWork",
          "QuickServe",
          "TrustBrand",
        ];
  const name = `${types[i % types.length]} ${city} ${i > 9 ? `#${i}` : ""}`.trim();
  const areas = [
    "Andheri",
    "Bandra",
    "Powai",
    "Dadar",
    "Kurla",
    "Thane",
    "Malad",
    "Goregaon",
    "Borivali",
    "Worli",
  ];
  const area = areas[i % areas.length];
  const phones = [
    "+91 98765 43210",
    "+91 87654 32109",
    "+91 76543 21098",
    "+91 91234 56789",
  ];
  const domains = name.toLowerCase().replace(/[^a-z]/g, "") + ".com";
  return {
    id: i + 1,
    name,
    phone: phones[i % phones.length],
    email: `info@${domains}`,
    address: `${i + 1}, ${area} Road, ${city} - ${400001 + i}`,
    location_full: `${i + 1}, ${area} Road, ${city}, Maharashtra, India - ${400001 + i}`,
    website: `https://www.${domains}`,
    category: query.split(" ")[0],
    rating: (3.5 + Math.random() * 1.5).toFixed(1),
    reviews: Math.floor(Math.random() * 500 + 10),
    maps_url: `https://maps.google.com/?q=${encodeURIComponent(name + " " + city)}`,
  };
}

function exportCSV(leads) {
  const headers = [
    "Name",
    "Full Location",
    "Phone",
    "Email",
    "Address",
    "Website",
    "Category",
    "Rating",
    "Reviews",
    "Maps URL",
  ];
  const rows = leads.map((l) => [
    l.name,
    l.location_full || l.address,
    l.phone,
    l.email,
    l.address,
    l.website,
    l.category,
    l.rating,
    l.reviews,
    l.maps_url,
  ]);
  const csv = [headers, ...rows]
    .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `leads_${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportJSON(leads) {
  const blob = new Blob([JSON.stringify(leads, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `leads_${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function parseCSVText(text) {
  const rows = [];
  let current = "";
  let row = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const nextChar = text[i + 1];
    if (char === '"' && inQuotes && nextChar === '"') {
      current += '"';
      i += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      row.push(current);
      current = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") i += 1;
      row.push(current);
      current = "";
      if (row.some((cell) => cell.trim() !== "")) rows.push(row);
      row = [];
    } else {
      current += char;
    }
  }
  if (current.length || row.length) {
    row.push(current);
    rows.push(row);
  }

  if (!rows.length) return [];
  const headers = rows[0].map((h) => h.trim().toLowerCase());
  return rows.slice(1).map((cells) => {
    const obj = {};
    headers.forEach((header, idx) => {
      obj[header] = (cells[idx] || "").trim();
    });
    return obj;
  });
}

function StatCard({ icon, label, value, accent }) {
  return (
    <div
      style={{
        background: "var(--color-background-secondary)",
        borderRadius: "var(--border-radius-lg)",
        padding: "1rem 1.25rem",
        border: accent
          ? `1.5px solid var(--color-border-${accent})`
          : "0.5px solid var(--color-border-tertiary)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <i
          className={`ti ${icon}`}
          style={{
            fontSize: 16,
            color: `var(--color-text-${accent || "secondary"})`,
          }}
          aria-hidden="true"
        />
        <span
          style={{
            fontSize: 12,
            color: "var(--color-text-secondary)",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          {label}
        </span>
      </div>
      <div style={{ fontSize: 26, fontWeight: 500 }}>{value}</div>
    </div>
  );
}

function LeadRow({ lead, index }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div style={{ borderBottom: "0.5px solid var(--color-border-tertiary)" }}>
      <div
        onClick={() => setExpanded((e) => !e)}
        style={{
          display: "grid",
          gridTemplateColumns: "32px 1fr 220px 130px 170px 80px 80px 32px",
          alignItems: "center",
          gap: 12,
          padding: "10px 16px",
          cursor: "pointer",
          transition: "background 0.15s",
        }}
        onMouseEnter={(e) =>
          (e.currentTarget.style.background = "var(--color-background-secondary)")
        }
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      >
        <span
          style={{
            fontSize: 12,
            color: "var(--color-text-tertiary)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {index + 1}
        </span>
        <div>
          <div style={{ fontWeight: 500, fontSize: 14 }}>{lead.name}</div>
          <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
            {lead.category}
          </div>
        </div>
        <span
          style={{
            fontSize: 12,
            color: "var(--color-text-secondary)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          title={lead.location_full || lead.address}
        >
          {lead.location_full || lead.address}
        </span>
        <span
          style={{
            color: "var(--color-text-secondary)",
            fontFamily: "var(--font-mono)",
            fontSize: 12,
          }}
        >
          {lead.phone}
        </span>
        <span
          style={{
            fontSize: 12,
            color: "var(--color-text-info)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {lead.email}
        </span>
        <span style={{ fontSize: 12 }}>⭐ {lead.rating}</span>
        <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
          {Number(lead.reviews).toLocaleString()} rev.
        </span>
        <i
          className={`ti ti-chevron-${expanded ? "up" : "down"}`}
          style={{ fontSize: 14, color: "var(--color-text-tertiary)" }}
          aria-hidden="true"
        />
      </div>
      {expanded && (
        <div
          style={{
            padding: "0 16px 14px 60px",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 8,
          }}
        >
          {[
            ["ti-map-pin", "Exact Location", lead.location_full || lead.address],
            ["ti-world", "Website", lead.website, true],
            ["ti-map", "Google Maps", lead.maps_url, true],
          ].map(([icon, label, val, link]) => (
            <div key={label} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <i
                className={`ti ${icon}`}
                style={{
                  fontSize: 14,
                  color: "var(--color-text-secondary)",
                  marginTop: 2,
                }}
                aria-hidden="true"
              />
              <div>
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--color-text-tertiary)",
                    marginBottom: 2,
                  }}
                >
                  {label}
                </div>
                {link ? (
                  <a
                    href={val}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      fontSize: 13,
                      color: "var(--color-text-info)",
                      textDecoration: "none",
                      wordBreak: "break-all",
                    }}
                  >
                    {val}
                  </a>
                ) : (
                  <span style={{ fontSize: 13 }}>{val}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function LeadGenApp() {
  const [query, setQuery] = useState("");
  const [leadCount, setLeadCount] = useState(10);
  const [keepGoing, setKeepGoing] = useState(false);
  const [fetchEmails, setFetchEmails] = useState(true);
  const [format, setFormat] = useState("csv");
  const [status, setStatus] = useState(STATUS.IDLE);
  const [leads, setLeads] = useState([]);
  const [progress, setProgress] = useState(0);
  const [log, setLog] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [tab, setTab] = useState("results");
  const timerRef = useRef(null);
  const logRef = useRef(null);
  const fileRef = useRef(null);

  const addLog = (msg) => setLog((l) => [...l, `[${new Date().toLocaleTimeString()}] ${msg}`]);

  const normalizeLead = (lead, i) => ({
    id: i + 1,
    name: lead.name || "",
    phone: lead.phone || "",
    email: lead.email || "",
    address: lead.address || lead.location_full || "",
    location_full: lead.location_full || lead.address || "",
    website: lead.website || "",
    category: lead.category || "",
    rating: lead.rating || "",
    reviews: lead.reviews || 0,
    maps_url: lead.maps_url || "",
  });

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [log]);

  const handleStart = async () => {
    if (!query.trim() || status === STATUS.RUNNING) return;

    setStatus(STATUS.RUNNING);
    setProgress(15);
    setTab("log");
    setLog([]);
    addLog(`Starting real scrape for "${query}"...`);
    addLog(`Target: ${keepGoing ? "All available results" : `${leadCount} leads`}`);
    addLog("Launching Chromium and opening Google Maps...");

    try {
      const response = await fetch(`${API_BASE_URL}/api/scrape`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: query.trim(),
          count: leadCount,
          keepGoing,
          fetchEmails,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Scrape request failed.");
      }

      const normalized = (payload.leads || []).map((lead, i) => normalizeLead(lead, i));
      setLeads(normalized);
      setProgress(100);
      setStatus(STATUS.DONE);
      setTab("results");
      addLog(`[OK] Scrape done. ${normalized.length} leads loaded.`);
      if (payload.outputFile) {
        addLog(`[OK] File saved: ${payload.outputFile}`);
      }
      if (payload.logs) {
        addLog("[OK] Scraper run completed on backend.");
      }
    } catch (err) {
      setStatus(STATUS.ERROR);
      addLog(`[warn] ${String(err.message || err)}`);
    }
  };

  const handleStop = async () => {
    clearInterval(timerRef.current);
    try {
      await fetch(`${API_BASE_URL}/api/stop`, { method: "POST" });
      addLog("⏹ Scraping stopped by user.");
    } catch (_err) {
      addLog("[warn] Could not stop scrape process.");
    }
    setStatus(STATUS.IDLE);
    setProgress(0);
  };

  const handleExport = () => {
    if (!leads.length) return;
    if (format === "json") exportJSON(leads);
    else exportCSV(leads);
  };

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    let imported = [];

    if (file.name.toLowerCase().endsWith(".json")) {
      try {
        const json = JSON.parse(text);
        if (Array.isArray(json)) imported = json;
      } catch (_err) {
        imported = [];
      }
    } else if (file.name.toLowerCase().endsWith(".csv")) {
      imported = parseCSVText(text);
    }

    if (!imported.length) {
      setStatus(STATUS.ERROR);
      addLog(`[warn] Could not import data from ${file.name}`);
      return;
    }

    const normalized = imported.map((lead, i) => normalizeLead(lead, i));
    setLeads(normalized);
    setStatus(STATUS.DONE);
    setProgress(100);
    setTab("results");
    addLog(`[OK] Imported ${normalized.length} real leads from ${file.name}`);
    e.target.value = "";
  };

  const filtered = leads.filter(
    (l) =>
      !searchTerm ||
      [l.name, l.email, l.phone, l.address, l.location_full, l.category].some((v) =>
        v?.toLowerCase().includes(searchTerm.toLowerCase())
      )
  );

  const withEmail = leads.filter((l) => l.email).length;
  const withPhone = leads.filter((l) => l.phone).length;
  const withWebsite = leads.filter((l) => l.website).length;

  return (
    <div style={{ fontFamily: "var(--font-sans)", maxWidth: 900, margin: "0 auto", paddingBottom: "3rem" }}>
      <h2 className="sr-only">Google Maps Lead Generation Platform</h2>

      <div style={{ padding: "1.5rem 0 1rem", borderBottom: "0.5px solid var(--color-border-tertiary)", marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--color-background-info)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <i className="ti ti-map-search" style={{ fontSize: 20, color: "var(--color-text-info)" }} aria-hidden="true" />
          </div>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 500, margin: 0 }}>LeadGen — Google Maps Scraper</h1>
            <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: 0 }}>Type a keyword → Chromium scrapes Google Maps → Export leads</p>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, marginBottom: "1.25rem" }}>
        <div style={{ position: "relative" }}>
          <i className="ti ti-search" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 16, color: "var(--color-text-tertiary)", pointerEvents: "none" }} aria-hidden="true" />
          <input
            type="text"
            placeholder='e.g. "Gyms in Mumbai", "Restaurants in Delhi"...'
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && status !== STATUS.RUNNING && handleStart()}
            disabled={status === STATUS.RUNNING}
            style={{ width: "100%", padding: "10px 12px 10px 38px", fontSize: 15, boxSizing: "border-box" }}
          />
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            ref={fileRef}
            type="file"
            accept=".json,.csv"
            onChange={handleImportFile}
            style={{ display: "none" }}
          />
          <button onClick={() => fileRef.current?.click()} style={{ padding: "0 16px", background: "var(--color-background-info)", color: "var(--color-text-info)", border: "0.5px solid var(--color-border-info)", borderRadius: "var(--border-radius-md)", cursor: "pointer", fontWeight: 500 }}>
            <i className="ti ti-file-import" aria-hidden="true" /> Import Data
          </button>
          {status === STATUS.RUNNING ? (
            <button onClick={handleStop} style={{ padding: "0 20px", background: "var(--color-background-danger)", color: "var(--color-text-danger)", border: "0.5px solid var(--color-border-danger)", borderRadius: "var(--border-radius-md)", cursor: "pointer", fontWeight: 500 }}>
              <i className="ti ti-player-stop" aria-hidden="true" /> Stop
            </button>
          ) : (
            <button onClick={handleStart} disabled={!query.trim()} style={{ padding: "0 24px", background: status === STATUS.DONE ? "var(--color-background-success)" : "var(--color-background-info)", color: status === STATUS.DONE ? "var(--color-text-success)" : "var(--color-text-info)", border: `0.5px solid ${status === STATUS.DONE ? "var(--color-border-success)" : "var(--color-border-info)"}`, borderRadius: "var(--border-radius-md)", cursor: "pointer", fontWeight: 500, opacity: !query.trim() ? 0.5 : 1 }}>
              <i className="ti ti-player-play" aria-hidden="true" /> {status === STATUS.DONE ? "Run Again" : "Start Scraping"}
            </button>
          )}
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", marginBottom: "1.5rem", padding: "14px 16px", background: "var(--color-background-secondary)", borderRadius: "var(--border-radius-lg)", border: "0.5px solid var(--color-border-tertiary)" }}>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "var(--color-text-secondary)", marginRight: 4 }}>Leads:</span>
          {PRESET_COUNTS.map((n) => (
            <button key={n} onClick={() => { setLeadCount(n); setKeepGoing(false); }} style={{ padding: "4px 10px", fontSize: 12, borderRadius: 6, cursor: "pointer", background: !keepGoing && leadCount === n ? "var(--color-background-info)" : "var(--color-background-primary)", color: !keepGoing && leadCount === n ? "var(--color-text-info)" : "var(--color-text-primary)", border: !keepGoing && leadCount === n ? "1px solid var(--color-border-info)" : "0.5px solid var(--color-border-tertiary)", fontWeight: !keepGoing && leadCount === n ? 500 : 400 }}>
              {n}
            </button>
          ))}
          <button onClick={() => setKeepGoing((k) => !k)} style={{ padding: "4px 10px", fontSize: 12, borderRadius: 6, cursor: "pointer", background: keepGoing ? "var(--color-background-warning)" : "var(--color-background-primary)", color: keepGoing ? "var(--color-text-warning)" : "var(--color-text-secondary)", border: keepGoing ? "1px solid var(--color-border-warning)" : "0.5px solid var(--color-border-tertiary)" }}>
            ∞ All
          </button>
        </div>

        <div style={{ width: "0.5px", height: 20, background: "var(--color-border-tertiary)" }} />

        <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13 }}>
          <input type="checkbox" checked={fetchEmails} onChange={(e) => setFetchEmails(e.target.checked)} style={{ width: 14, height: 14 }} />
          <span>Fetch Emails</span>
        </label>

        <div style={{ width: "0.5px", height: 20, background: "var(--color-border-tertiary)" }} />

        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>Export as:</span>
          {["csv", "json"].map((f) => (
            <button key={f} onClick={() => setFormat(f)} style={{ padding: "4px 10px", fontSize: 12, borderRadius: 6, cursor: "pointer", background: format === f ? "var(--color-background-success)" : "var(--color-background-primary)", color: format === f ? "var(--color-text-success)" : "var(--color-text-secondary)", border: format === f ? "1px solid var(--color-border-success)" : "0.5px solid var(--color-border-tertiary)", textTransform: "uppercase" }}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {(status === STATUS.RUNNING || status === STATUS.DONE) && (
        <div style={{ marginBottom: "1.25rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
              {status === STATUS.RUNNING ? `Scraping... ${leads.length} leads found` : `✅ Complete — ${leads.length} leads scraped`}
            </span>
            <span style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--color-text-tertiary)" }}>
              {progress}%
            </span>
          </div>
          <div style={{ height: 4, background: "var(--color-border-tertiary)", borderRadius: 2, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${progress}%`, background: status === STATUS.DONE ? "var(--color-border-success)" : "var(--color-border-info)", borderRadius: 2, transition: "width 0.3s" }} />
          </div>
        </div>
      )}

      {leads.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: "1.5rem" }}>
          <StatCard icon="ti-users" label="Total Leads" value={leads.length.toLocaleString()} accent="info" />
          <StatCard icon="ti-mail" label="With Email" value={withEmail.toLocaleString()} />
          <StatCard icon="ti-phone" label="With Phone" value={withPhone.toLocaleString()} />
          <StatCard icon="ti-world" label="With Website" value={withWebsite.toLocaleString()} />
        </div>
      )}

      {leads.length > 0 && (
        <>
          <div style={{ display: "flex", gap: 0, marginBottom: "1rem", borderBottom: "0.5px solid var(--color-border-tertiary)" }}>
            {[["results", "ti-table", "Results"], ["log", "ti-terminal", "Activity Log"]].map(([t, icon, label]) => (
              <button key={t} onClick={() => setTab(t)} style={{ padding: "8px 16px", fontSize: 13, cursor: "pointer", background: "transparent", border: "none", borderBottom: tab === t ? "2px solid var(--color-border-info)" : "2px solid transparent", color: tab === t ? "var(--color-text-info)" : "var(--color-text-secondary)", fontWeight: tab === t ? 500 : 400, marginBottom: -1 }}>
                <i className={`ti ${icon}`} style={{ marginRight: 6 }} aria-hidden="true" />
                {label}
              </button>
            ))}
            <div style={{ flex: 1 }} />
            <button onClick={handleExport} style={{ padding: "6px 16px", margin: "4px 0", fontSize: 13, cursor: "pointer", borderRadius: "var(--border-radius-md)", background: "var(--color-background-success)", color: "var(--color-text-success)", border: "0.5px solid var(--color-border-success)", fontWeight: 500 }}>
              <i className="ti ti-download" style={{ marginRight: 6 }} aria-hidden="true" />
              Export {format.toUpperCase()}
            </button>
          </div>

          {tab === "results" && (
            <>
              <div style={{ position: "relative", marginBottom: 12 }}>
                <i className="ti ti-search" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 14, color: "var(--color-text-tertiary)", pointerEvents: "none" }} aria-hidden="true" />
                <input type="text" placeholder="Filter by name, location, email, phone..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ width: "100%", padding: "8px 12px 8px 32px", fontSize: 13, boxSizing: "border-box" }} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "32px 1fr 220px 130px 170px 80px 80px 32px", gap: 12, padding: "8px 16px", background: "var(--color-background-secondary)", borderRadius: "var(--border-radius-md) var(--border-radius-md) 0 0", border: "0.5px solid var(--color-border-tertiary)", borderBottom: "none" }}>
                {["#", "Name / Category", "Location", "Phone", "Email", "Rating", "Reviews", ""].map((h, i) => (
                  <span key={i} style={{ fontSize: 11, color: "var(--color-text-tertiary)", textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 500 }}>
                    {h}
                  </span>
                ))}
              </div>

              <div style={{ border: "0.5px solid var(--color-border-tertiary)", borderRadius: "0 0 var(--border-radius-lg) var(--border-radius-lg)", maxHeight: 440, overflowY: "auto" }}>
                {filtered.length === 0 ? (
                  <div style={{ padding: "2rem", textAlign: "center", color: "var(--color-text-tertiary)", fontSize: 13 }}>
                    No leads match your filter.
                  </div>
                ) : (
                  filtered.map((lead, i) => <LeadRow key={lead.id} lead={lead} index={i} />)
                )}
              </div>
              {filtered.length < leads.length && (
                <div style={{ fontSize: 12, color: "var(--color-text-tertiary)", textAlign: "right", marginTop: 6 }}>
                  Showing {filtered.length} of {leads.length} leads
                </div>
              )}
            </>
          )}

          {tab === "log" && (
            <div ref={logRef} style={{ height: 320, overflowY: "auto", background: "#111", borderRadius: "var(--border-radius-lg)", padding: "1rem", fontFamily: "var(--font-mono)", fontSize: 12, lineHeight: 1.8 }}>
              {log.map((line, i) => (
                <div key={i} style={{ color: line.includes("✅") ? "#4ade80" : line.includes("⏹") ? "#facc15" : line.includes("[warn]") ? "#f87171" : "#a3a3a3" }}>
                  {line}
                </div>
              ))}
              {status === STATUS.RUNNING && (
                <div style={{ color: "#60a5fa", animation: "pulse 1s infinite" }}>▌</div>
              )}
            </div>
          )}
        </>
      )}

      {status === STATUS.IDLE && (
        <div style={{ textAlign: "center", padding: "3rem 0", color: "var(--color-text-tertiary)" }}>
          <i className="ti ti-map-search" style={{ fontSize: 40, display: "block", marginBottom: "1rem" }} aria-hidden="true" />
          <p style={{ fontSize: 14, margin: 0 }}>
            Enter a keyword like <strong>"Gyms in Mumbai"</strong> or{" "}
            <strong>"IT companies Pune"</strong> and click Start
          </p>
          <p style={{ fontSize: 12, marginTop: 8, color: "var(--color-text-tertiary)" }}>
            Click <code>Start Scraping</code> for real Chromium scraping or import your CSV/JSON file.
          </p>
        </div>
      )}

      <details style={{ marginTop: "2rem", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", overflow: "hidden" }}>
        <summary style={{ padding: "12px 16px", cursor: "pointer", fontSize: 14, fontWeight: 500, background: "var(--color-background-secondary)", userSelect: "none" }}>
          <i className="ti ti-terminal" style={{ marginRight: 8 }} aria-hidden="true" />
          Backend setup instructions
        </summary>
        <div style={{ padding: "1rem 1.25rem", fontSize: 13, lineHeight: 1.8 }}>
          <p style={{ margin: "0 0 8px", fontWeight: 500 }}>1. Install dependencies</p>
          <pre style={{ background: "var(--color-background-secondary)", padding: "10px 14px", borderRadius: "var(--border-radius-md)", fontFamily: "var(--font-mono)", fontSize: 12, overflow: "auto" }}>{`pip install playwright pandas openpyxl
playwright install chromium`}</pre>
          <p style={{ margin: "12px 0 8px", fontWeight: 500 }}>2. Run the scraper</p>
          <pre style={{ background: "var(--color-background-secondary)", padding: "10px 14px", borderRadius: "var(--border-radius-md)", fontFamily: "var(--font-mono)", fontSize: 12, overflow: "auto" }}>{`python gmaps_scraper.py "Gyms in Mumbai" --count 100
python gmaps_scraper.py "Restaurants in Delhi" --count 200 --format excel
python gmaps_scraper.py "IT companies Pune" --keep-going
python gmaps_scraper.py "Salons Bangalore" --count 50 --no-email`}</pre>
          <p style={{ margin: "12px 0 4px", color: "var(--color-text-secondary)" }}>
            Output is saved to <code>./leads_output/</code> as CSV, Excel, or JSON.
          </p>
        </div>
      </details>
    </div>
  );
}
