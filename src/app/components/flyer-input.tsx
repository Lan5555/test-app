'use client'
import React, { useEffect, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface FlyerData {
  badgeLabel: string;
  announcementTitle: string;
  bodyText: string;
  date: string;
  time: string;
  venue: string;
  targetAudience: string;
  actionNote: string;
  directorName: string;
  directorRole: string;
  referenceNo: string;
  month: string;
  email: string;
  uniLogo: string;
  nacosLogo: string;
}

// ─── Default values ──────────────────────────────────────────────────────────
const defaultFlyerData: FlyerData = {
  badgeLabel: "📢 Announcement",
  announcementTitle: "Mandatory Tech Summit\nfor All CS Students",
  bodyText: `Dear students and staff,\n\nThis is an official notice from the Directorate of Tech and Innovation, University of Jos. All final-year Computer Science students are hereby invited to attend the upcoming Tech & Innovation Summit. Attendance is compulsory and will be recorded.`,
  date: "Friday, 16 May 2025",
  time: "10:00 AM — 2:00 PM",
  venue: "Main Auditorium, UniJos",
  targetAudience: "All CS / IT Students",
  actionNote:
    "Students are advised to come with their student ID cards and note that refreshments will be provided. For enquiries, contact the Tech Directorate office or your department's NACOS representative.",
  directorName: "Dr. A. Ibrahim",
  directorRole: "Director, Tech & Innovation — University of Jos",
  referenceNo: "UniJos/TI/2025/001",
  month: "May 2025",
  email: "tech@unijos.edu.ng",
  uniLogo: "/logos/unijos.jpeg",
  nacosLogo: "/logos/nacos.jpeg",
};

// ─── Input Field Component ───────────────────────────────────────────────────
interface InputFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "textarea" | "email" | "date" | "url";
  placeholder?: string;
  icon?: string;
  required?: boolean;
  rows?: number;
  preview?: boolean;
}

const InputField: React.FC<InputFieldProps> = ({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  icon,
  required = false,
  rows = 4,
  preview = false,
}) => {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <div style={{ marginBottom: 20 }}>
      <label
        style={{
          display: "block",
          fontSize: 13,
          fontWeight: 600,
          marginBottom: 8,
          color: isFocused ? "#667eea" : "#4a5568",
          transition: "color 0.3s ease",
          textTransform: "uppercase",
          letterSpacing: "0.5px",
        }}
      >
        {icon && <span style={{ marginRight: 6 }}>{icon}</span>}
        {label}
        {required && <span style={{ color: "#f093fb", marginLeft: 4 }}>*</span>}
      </label>
      {type === "textarea" ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          style={{
            width: "100%",
            padding: "12px 16px",
            border: `2px solid ${isFocused ? "#667eea" : "#e2e8f0"}`,
            borderRadius: 12,
            fontSize: 14,
            fontFamily: "inherit",
            transition: "all 0.3s ease",
            outline: "none",
            backgroundColor: isFocused ? "#fff" : "#f8fafc",
            resize: "vertical",
            color: "#000",
          }}
        />
      ) : (
        <>
          <input
            type={type}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            style={{
              width: "100%",
              padding: "12px 16px",
              border: `2px solid ${isFocused ? "#667eea" : "#e2e8f0"}`,
              borderRadius: 12,
              fontSize: 14,
              fontFamily: "inherit",
              transition: "all 0.3s ease",
              outline: "none",
              backgroundColor: isFocused ? "#fff" : "#f8fafc",
              color: "#000",
            }}
          />
          {preview && value && type === "url" && (
            <div style={{ marginTop: 8 }}>
              <img 
                src={value} 
                alt={label}
                style={{
                  maxWidth: "100%",
                  maxHeight: 100,
                  objectFit: "contain",
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                  padding: 4,
                  background: "#fff",
                }}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                  const errorMsg = document.createElement('div');
                  errorMsg.textContent = "⚠️ Invalid image URL";
                  errorMsg.style.color = "#ef4444";
                  errorMsg.style.fontSize = "12px";
                  errorMsg.style.marginTop = "4px";
                  (e.target as HTMLImageElement).parentElement?.appendChild(errorMsg);
                  setTimeout(() => errorMsg.remove(), 3000);
                }}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
};

// ─── Section Header Component ────────────────────────────────────────────────
interface SectionHeaderProps {
  title: string;
  icon: string;
  description?: string;
}

const SectionHeader: React.FC<SectionHeaderProps> = ({ title, icon, description }) => (
  <div style={{ marginBottom: 24, position: "relative" }}>
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        marginBottom: 8,
      }}
    >
      <span style={{ fontSize: 24 }}>{icon}</span>
      <h2
        style={{
          fontSize: 20,
          fontWeight: 700,
          background: "linear-gradient(135deg, #1a1a2e, #16213e)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
          margin: 0,
        }}
      >
        {title}
      </h2>
    </div>
    {description && (
      <p
        style={{
          fontSize: 13,
          color: "#718096",
          marginLeft: 34,
          marginTop: -4,
        }}
      >
        {description}
      </p>
    )}
    <div
      style={{
        height: 2,
        background: "linear-gradient(90deg, #667eea, #764ba2, #f093fb)",
        width: 50,
        marginTop: 8,
        borderRadius: 2,
      }}
    />
  </div>
);

// ─── Main Admin Page Component ───────────────────────────────────────────────
interface FlyerAdminPageProps {
  onSubmit?: (data: FlyerData) => void;
  onPreview?: (data: FlyerData) => void;
  initialData?: Partial<FlyerData>;
}

const FlyerAdminPage: React.FC<FlyerAdminPageProps> = ({
  onSubmit,
  onPreview,
  initialData = {},
}) => {
  const [flyerData, setFlyerData] = useState<FlyerData>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('flyer_draft');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          console.error("Failed to parse flyer draft", e);
        }
      }
    }
    return { ...defaultFlyerData, ...initialData };
  });
  const [activeTab, setActiveTab] = useState<"edit" | "preview">("edit");
  const [showSuccess, setShowSuccess] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Fix hydration mismatch for random values and time
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    localStorage.setItem('flyer_draft', JSON.stringify(flyerData));
  }, [flyerData]);

  const updateField = (field: keyof FlyerData, value: string) => {
    setFlyerData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = () => {
    if (onSubmit) {
      onSubmit(flyerData);
    }
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  const handlePreview = () => {
    if (onPreview) {
      onPreview(flyerData);
    }
    setActiveTab("preview");
  };

  const handleReset = () => {
    if (window.confirm("Are you sure you want to reset all fields to default values?")) {
      setFlyerData(defaultFlyerData);
      localStorage.removeItem('flyer_draft');
    }
  };

  return (
    <>
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
          .admin-page * { box-sizing: border-box; margin: 0; padding: 0; }
          .admin-page { font-family: 'Inter', sans-serif; }
        `}
      </style>

      <div className="admin-page" style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)",
        padding: "40px 20px",
        position: "relative",
        overflow: "hidden",
      }}>
        {/* Animated Background */}
        <div style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          overflow: "hidden",
          pointerEvents: "none",
        }}>
          {mounted && [...Array(30)].map((_, i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                width: Math.random() * 200 + 50,
                height: Math.random() * 200 + 50,
                background: "radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)",
                borderRadius: "50%",
                top: `${Math.random() * 100}%`,
                left: `${Math.random() * 100}%`,
                animation: `float ${Math.random() * 15 + 10}s infinite ease-in-out`,
                animationDelay: `${Math.random() * 5}s`,
              }}
            />
          ))}
        </div>

        {/* Main Container */}
        <div style={{
          maxWidth: 1200,
          margin: "0 auto",
          position: "relative",
          zIndex: 1,
        }}>
          {/* Header */}
          <div style={{
            textAlign: "center",
            marginBottom: 40,
          }}>
            <div style={{
              display: "inline-block",
              background: "rgba(255,255,255,0.2)",
              backdropFilter: "blur(10px)",
              padding: "8px 20px",
              borderRadius: 40,
              marginBottom: 20,
              border: "1px solid rgba(255,255,255,0.3)",
            }}>
              <span style={{ color: "#fff", fontWeight: 600, fontSize: 14 }}>
                🎨 Content Management System
              </span>
            </div>
            <h1 style={{
              fontSize: 48,
              fontWeight: 800,
              color: "#fff",
              marginBottom: 12,
              textShadow: "0 2px 10px rgba(0,0,0,0.2)",
            }}>
              Flyer Editor
            </h1>
            <p style={{
              fontSize: 16,
              color: "rgba(255,255,255,0.9)",
              maxWidth: 500,
              margin: "0 auto",
            }}>
              Customize your announcement flyer with real-time preview
            </p>
          </div>

          {/* Tab Navigation */}
          <div style={{
            display: "flex",
            gap: 12,
            marginBottom: 30,
            justifyContent: "center",
          }}>
            {["edit", "preview"].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as "edit" | "preview")}
                style={{
                  padding: "10px 28px",
                  background: activeTab === tab 
                    ? "rgba(255,255,255,0.95)"
                    : "rgba(255,255,255,0.2)",
                  backdropFilter: "blur(10px)",
                  border: activeTab === tab 
                    ? "none"
                    : "1px solid rgba(255,255,255,0.3)",
                  borderRadius: 40,
                  color: activeTab === tab ? "#667eea" : "#fff",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.3s ease",
                  fontSize: 14,
                  textTransform: "capitalize",
                }}
              >
                {tab === "edit" ? "✏️ Edit Content" : "👁️ Preview Flyer"}
              </button>
            ))}
          </div>

          {/* Success Message */}
          {showSuccess && (
            <div style={{
              background: "linear-gradient(135deg, #10b981, #059669)",
              color: "#fff",
              padding: "12px 20px",
              borderRadius: 12,
              marginBottom: 20,
              textAlign: "center",
              animation: "slideDown 0.3s ease",
            }}>
              ✅ Flyer data saved successfully!
            </div>
          )}

          {/* Content Area */}
          <div style={{
            background: "rgba(255,255,255,0.95)",
            backdropFilter: "blur(20px)",
            borderRadius: 24,
            overflow: "hidden",
            boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
          }}>
            {activeTab === "edit" ? (
              <div style={{ padding: 40 }}>
                {/* Logo Images Section */}
                <SectionHeader 
                  title="Logo Images" 
                  icon="🖼️"
                  description="URL links for University and NACOS logos"
                />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 40 }}>
                  <InputField
                    label="University of Jos Logo URL"
                    value={flyerData.uniLogo}
                    onChange={(v) => updateField("uniLogo", v)}
                    type="url"
                    icon="🏛️"
                    placeholder="https://example.com/unijos-logo.png"
                    preview={true}
                  />
                  <InputField
                    label="NACOS Logo URL"
                    value={flyerData.nacosLogo}
                    onChange={(v) => updateField("nacosLogo", v)}
                    type="url"
                    icon="💻"
                    placeholder="https://example.com/nacos-logo.png"
                    preview={true}
                  />
                </div>

                {/* Basic Information Section */}
                <SectionHeader 
                  title="Basic Information" 
                  icon="📋"
                  description="Essential details for your announcement"
                />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 40 }}>
                  <InputField
                    label="Badge Label"
                    value={flyerData.badgeLabel}
                    onChange={(v) => updateField("badgeLabel", v)}
                    icon="🏷️"
                    placeholder="e.g., 📢 Announcement"
                  />
                  <InputField
                    label="Target Audience"
                    value={flyerData.targetAudience}
                    onChange={(v) => updateField("targetAudience", v)}
                    icon="👥"
                    placeholder="e.g., All CS / IT Students"
                  />
                </div>

                <InputField
                  label="Announcement Title"
                  value={flyerData.announcementTitle}
                  onChange={(v) => updateField("announcementTitle", v)}
                  type="textarea"
                  icon="📌"
                  rows={2}
                  placeholder="Main title of your announcement"
                />

                <InputField
                  label="Body Text"
                  value={flyerData.bodyText}
                  onChange={(v) => updateField("bodyText", v)}
                  type="textarea"
                  icon="📝"
                  rows={6}
                  placeholder="Main content of the announcement"
                />

                {/* Event Details Section */}
                <SectionHeader 
                  title="Event Details" 
                  icon="📅"
                  description="Date, time, and location information"
                />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 40 }}>
                  <InputField
                    label="Date"
                    value={flyerData.date}
                    onChange={(v) => updateField("date", v)}
                    icon="📅"
                    placeholder="e.g., Friday, 16 May 2025"
                  />
                  <InputField
                    label="Time"
                    value={flyerData.time}
                    onChange={(v) => updateField("time", v)}
                    icon="⏰"
                    placeholder="e.g., 10:00 AM — 2:00 PM"
                  />
                  <InputField
                    label="Venue"
                    value={flyerData.venue}
                    onChange={(v) => updateField("venue", v)}
                    icon="📍"
                    placeholder="e.g., Main Auditorium"
                  />
                  <InputField
                    label="Month / Period"
                    value={flyerData.month}
                    onChange={(v) => updateField("month", v)}
                    icon="📆"
                    placeholder="e.g., May 2025"
                  />
                </div>

                {/* Action & Notes Section */}
                <SectionHeader 
                  title="Action & Notes" 
                  icon="💡"
                  description="Additional instructions for attendees"
                />
                <InputField
                  label="Action Note"
                  value={flyerData.actionNote}
                  onChange={(v) => updateField("actionNote", v)}
                  type="textarea"
                  icon="📢"
                  rows={3}
                  placeholder="Important instructions for attendees"
                />

                {/* Official Information Section */}
                <SectionHeader 
                  title="Official Information" 
                  icon="👔"
                  description="Directorate and reference details"
                />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 40 }}>
                  <InputField
                    label="Director Name"
                    value={flyerData.directorName}
                    onChange={(v) => updateField("directorName", v)}
                    icon="👤"
                    placeholder="e.g., Dr. A. Ibrahim"
                  />
                  <InputField
                    label="Director Role"
                    value={flyerData.directorRole}
                    onChange={(v) => updateField("directorRole", v)}
                    icon="💼"
                    placeholder="e.g., Director, Tech & Innovation"
                  />
                  <InputField
                    label="Reference Number"
                    value={flyerData.referenceNo}
                    onChange={(v) => updateField("referenceNo", v)}
                    icon="🔖"
                    placeholder="e.g., UniJos/TI/2025/001"
                  />
                  <InputField
                    label="Contact Email"
                    value={flyerData.email}
                    onChange={(v) => updateField("email", v)}
                    type="email"
                    icon="📧"
                    placeholder="e.g., tech@unijos.edu.ng"
                  />
                </div>

                {/* Action Buttons */}
                <div style={{
                  display: "flex",
                  gap: 16,
                  justifyContent: "flex-end",
                  marginTop: 20,
                  paddingTop: 20,
                  borderTop: "1px solid #e2e8f0",
                }}>
                  <button
                    onClick={handleReset}
                    style={{
                      padding: "12px 24px",
                      background: "#f1f5f9",
                      border: "none",
                      borderRadius: 12,
                      color: "#64748b",
                      fontWeight: 600,
                      cursor: "pointer",
                      transition: "all 0.3s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "#e2e8f0";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "#f1f5f9";
                    }}
                  >
                    🔄 Reset to Default
                  </button>
                  <button
                    onClick={handlePreview}
                    style={{
                      padding: "12px 24px",
                      background: "linear-gradient(135deg, #667eea, #764ba2)",
                      border: "none",
                      borderRadius: 12,
                      color: "#fff",
                      fontWeight: 600,
                      cursor: "pointer",
                      transition: "all 0.3s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = "translateY(-2px)";
                      e.currentTarget.style.boxShadow = "0 5px 15px rgba(102,126,234,0.4)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.boxShadow = "none";
                    }}
                  >
                    👁️ Preview Flyer
                  </button>
                  <button
                    onClick={handleSubmit}
                    style={{
                      padding: "12px 32px",
                      background: "linear-gradient(135deg, #10b981, #059669)",
                      border: "none",
                      borderRadius: 12,
                      color: "#fff",
                      fontWeight: 600,
                      cursor: "pointer",
                      transition: "all 0.3s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = "translateY(-2px)";
                      e.currentTarget.style.boxShadow = "0 5px 15px rgba(16,185,129,0.4)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.boxShadow = "none";
                    }}
                  >
                    💾 Save Changes
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ padding: 40, textAlign: "center" }}>
                <div style={{
                  background: "#f8fafc",
                  borderRadius: 16,
                  padding: 40,
                  marginBottom: 24,
                }}>
                  <p style={{ color: "#718096", marginBottom: 16 }}>
                    👈 Click "Edit Content" to make changes or use the button below to export
                  </p>
                  <button
                    onClick={() => {
                      const flyerDataStr = JSON.stringify(flyerData, null, 2);
                      const blob = new Blob([flyerDataStr], { type: "application/json" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = "flyer-data.json";
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                    style={{
                      padding: "10px 20px",
                      background: "linear-gradient(135deg, #667eea, #764ba2)",
                      border: "none",
                      borderRadius: 8,
                      color: "#fff",
                      cursor: "pointer",
                      marginRight: 12,
                    }}
                  >
                    📥 Export Data (JSON)
                  </button>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(JSON.stringify(flyerData, null, 2));
                      alert("Data copied to clipboard!");
                    }}
                    style={{
                      padding: "10px 20px",
                      background: "#f1f5f9",
                      border: "none",
                      borderRadius: 8,
                      color: "#475569",
                      cursor: "pointer",
                    }}
                  >
                    📋 Copy to Clipboard
                  </button>
                </div>
                <div style={{ maxHeight: 600, overflowY: "auto" }}>
                  <pre style={{
                    background: "#1e293b",
                    color: "#e2e8f0",
                    padding: 20,
                    borderRadius: 12,
                    textAlign: "left",
                    fontSize: 12,
                    overflow: "auto",
                  }}>
                    {JSON.stringify(flyerData, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>

          {/* Quick Stats */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 20,
            marginTop: 30,
          }}>
            {[
              { label: "Total Fields", value: "15", icon: "📊", color: "#667eea" },
              { label: "Characters", value: flyerData.bodyText.length.toString(), icon: "📝", color: "#764ba2" },
              { label: "Words", value: flyerData.bodyText.split(/\s+/).filter(Boolean).length.toString(), icon: "📖", color: "#f093fb" },
              { label: "Last Updated", value: mounted ? new Date().toLocaleTimeString() : "--:--", icon: "🕐", color: "#10b981" },
            ].map((stat, i) => (
              <div key={i} style={{
                background: "rgba(255,255,255,0.2)",
                backdropFilter: "blur(10px)",
                borderRadius: 16,
                padding: 16,
                textAlign: "center",
                border: "1px solid rgba(255,255,255,0.3)",
              }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>{stat.icon}</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: "#fff" }}>{stat.value}</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.8)", marginTop: 4 }}>{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>
        {`
          @keyframes float {
            0%, 100% { transform: translateY(0px) translateX(0px); }
            25% { transform: translateY(-20px) translateX(10px); }
            75% { transform: translateY(10px) translateX(-10px); }
          }
          @keyframes slideDown {
            from {
              opacity: 0;
              transform: translateY(-20px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          input::placeholder, textarea::placeholder {
            color: #000 !important;
          }
        `}
      </style>
    </>
  );
};

export default FlyerAdminPage;