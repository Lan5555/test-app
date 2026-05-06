'use client'
import React, { useEffect, useState, useRef } from "react";
import FlyerAdminPage from "../../components/flyer-input";
import { Button, Switch } from "@mui/material";
import { Edit, Camera, Download, Copy, Printer, DatabaseBackup } from "lucide-react";
import html2canvas from "html2canvas";

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

// ─── Default flyer content ─────────────────────────────────────────────────────
const defaultData: FlyerData = {
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
  uniLogo: '',
  nacosLogo: '',
};

const TopStripes: React.FC = () => (
  <>
    <div style={{ 
      height: 4, 
      background: "linear-gradient(90deg, #667eea 0%, #764ba2 50%, #f093fb 100%)",
      position: "relative",
      overflow: "hidden"
    }}>
      <div style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)",
        animation: "shimmer 2s infinite"
      }} />
    </div>
  </>
);

const BottomStripes: React.FC = () => (
  <div
    style={{
      height: 4,
      background: "linear-gradient(90deg, #667eea, #764ba2, #f093fb, #764ba2, #667eea)",
      backgroundSize: "200% 100%",
      animation: "gradientMove 3s ease infinite",
    }}
  />
);

interface HeaderProps {
  uniLogo: string;
  nacosLogo: string;
}

const FlyerHeader: React.FC<HeaderProps> = ({ uniLogo, nacosLogo }) => (
  <div
    style={{
      background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
      padding: "28px 32px 24px",
      display: "flex",
      alignItems: "center",
      gap: 20,
      position: "relative",
      overflow: "hidden",
    }}
  >
    <div style={{
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundImage: "radial-gradient(circle at 20% 50%, rgba(102, 126, 234, 0.1) 0%, transparent 50%)",
      pointerEvents: "none",
    }} />
    
    <div
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        height: 3,
        background: "linear-gradient(90deg, #667eea 0%, #764ba2 50%, #f093fb 100%)",
      }}
    />

    <div style={{ display: "flex", alignItems: "center", gap: 14, flexShrink: 0 }}>
      <div style={{
        background: "linear-gradient(135deg, #667eea, #764ba2)",
        borderRadius: "50%",
        padding: 2,
      }}>
        <img
          src={uniLogo}
          alt="University of Jos"
          style={{
            width: 68,
            height: 68,
            objectFit: "contain",
            borderRadius: "50%",
            background: "#fff",
            padding: 4,
          }}
          crossOrigin="anonymous"
        />
      </div>
      <div
        style={{ width: 1, height: 52, background: "linear-gradient(180deg, transparent, rgba(255,255,255,0.5), transparent)" }}
      />
      <div style={{
        background: "linear-gradient(135deg, #f093fb, #f5576c)",
        borderRadius: "50%",
        padding: 2,
      }}>
        <img
          src={nacosLogo}
          alt="NACOS"
          style={{
            width: 68,
            height: 68,
            objectFit: "contain",
            borderRadius: "50%",
            background: "#fff",
            padding: 4,
          }}
          crossOrigin="anonymous"
        />
      </div>
    </div>

    <div style={{ flex: 1, color: "#fff", position: "relative", zIndex: 1 }}>
      <p
        style={{
          fontSize: 10,
          letterSpacing: "2.5px",
          textTransform: "uppercase",
          background: "linear-gradient(135deg, #a8c0ff, #3f2b96)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
          fontWeight: 600,
          marginBottom: 4,
        }}
      >
        Official Communication
      </p>
      <h1
        style={{
          fontFamily: "'Poppins', sans-serif",
          fontSize: 17,
          fontWeight: 900,
          lineHeight: 1.25,
          margin: 0,
          background: "linear-gradient(135deg, #fff, #a8c0ff)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
        }}
      >
        Directorate of Tech
        <br />
        &amp; Innovation
      </h1>
      <p
        style={{
          fontSize: 11.5,
          color: "rgba(255,255,255,0.8)",
          marginTop: 4,
          fontWeight: 400,
          letterSpacing: "0.5px",
        }}
      >
         Faculty of Computing · University of Jos 
      </p>
    </div>
  </div>
);

interface InfoCardProps {
  label: string;
  value: string;
}

const InfoCard: React.FC<InfoCardProps> = ({ label, value }) => (
  <div
    style={{
      background: "linear-gradient(135deg, rgba(255,255,255,0.9), rgba(255,255,255,0.95))",
      backdropFilter: "blur(10px)",
      border: "1px solid rgba(102, 126, 234, 0.2)",
      borderRadius: 12,
      padding: "14px 16px",
      transition: "all 0.3s ease",
      cursor: "pointer",
      boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.transform = "translateY(-2px)";
      e.currentTarget.style.boxShadow = "0 8px 20px rgba(102, 126, 234, 0.15)";
      e.currentTarget.style.borderColor = "rgba(102, 126, 234, 0.4)";
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.transform = "translateY(0)";
      e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.05)";
      e.currentTarget.style.borderColor = "rgba(102, 126, 234, 0.2)";
    }}
  >
    <p
      style={{
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: "1.5px",
        textTransform: "uppercase",
        background: "linear-gradient(135deg, #667eea, #764ba2)",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        backgroundClip: "text",
        marginBottom: 4,
      }}
    >
      {label}
    </p>
    <p style={{ fontSize: 14, fontWeight: 500, color: "#1a1a2e" }}>{value}</p>
  </div>
);

// ─── Main Flyer Component ─────────────────────────────────────────────────────

interface UniJosTechFlyerProps {
  uniLogo?: string;
  nacosLogo?: string;
  data?: Partial<FlyerData>;
}

const UniJosTechFlyer: React.FC<UniJosTechFlyerProps> = () => {
  const [isEditing, setIsEditing] = useState<boolean>(true);
  const [flyer, setFlyer] = useState<FlyerData>(defaultData);
  const [continuationDropdown, showContinuationDropdown] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const flyerCaptureRef = useRef<HTMLDivElement>(null);
  const [date, showDate] = useState<boolean>(true);
  const [venue, showVenue] = useState<boolean>(true);
  

  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes shimmer {
        0% { transform: translateX(-100%); }
        100% { transform: translateX(100%); }
      }
      @keyframes gradientMove {
        0% { background-position: 0% 50%; }
        50% { background-position: 100% 50%; }
        100% { background-position: 0% 50%; }
      }
      @keyframes float {
        0%, 100% { transform: translateY(0px); }
        50% { transform: translateY(-10px); }
      }
      @keyframes pulse {
        0%, 100% { opacity: 0.6; }
        50% { opacity: 1; }
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  const handleFlyerDataChange = (flyerData: FlyerData) => {
    setIsEditing(false);
    setFlyer(flyerData);
  }

  // FIXED: Proper screenshot capture that respects exact styling
  const captureExactFlyer = async () => {
    if (!flyerCaptureRef.current) return null;
    
    const element = flyerCaptureRef.current;
    
    // Store original styles
    const originalPosition = element.style.position;
    const originalTop = element.style.top;
    const originalLeft = element.style.left;
    const originalTransform = element.style.transform;
    
    // Temporarily fix position for capture
    element.style.position = 'fixed';
    element.style.top = '0';
    element.style.left = '0';
    element.style.transform = 'none';
    
    // Wait for render
    await new Promise(resolve => setTimeout(resolve, 100));
    
    try {
      const canvas = await html2canvas(element, {
        scale: 2,
        backgroundColor: '#ffffff',
        logging: false,
        useCORS: true,
        allowTaint: false,
        windowWidth: element.scrollWidth,
        windowHeight: element.scrollHeight,
        onclone: (clonedDoc, element) => {
          // Ensure all styles are preserved in the clone
          console.log('Cloning document for capture');
        }
      });
      
      return canvas;
    } catch (error) {
      console.error('Capture error:', error);
      return null;
    } finally {
      // Restore original styles
      element.style.position = originalPosition;
      element.style.top = originalTop;
      element.style.left = originalLeft;
      element.style.transform = originalTransform;
    }
  };

  // Alternative: Create a hidden clone for capture
  const captureWithClone = async () => {
    if (!flyerCaptureRef.current) return null;
    
    const originalElement = flyerCaptureRef.current;
    
    // Create a clone of the flyer
    const clone = originalElement.cloneNode(true) as HTMLElement;
    clone.style.position = 'fixed';
    clone.style.top = '-9999px';
    clone.style.left = '-9999px';
    clone.style.width = '600px';
    clone.style.margin = '0';
    clone.style.boxShadow = 'none';
    
    document.body.appendChild(clone);
    
    // Wait for images to load
    const images = clone.getElementsByTagName('img');
    await Promise.all(Array.from(images).map(img => {
      if (img.complete) return Promise.resolve();
      return new Promise((resolve) => {
        img.onload = resolve;
        img.onerror = resolve;
      });
    }));
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const canvas = await html2canvas(clone, {
      scale: 2,
      backgroundColor: '#ffffff',
      logging: false,
      useCORS: true,
      allowTaint: false,
    });
    
    document.body.removeChild(clone);
    return canvas;
  };

  // Screenshot with best method
  const takeScreenshot = async () => {
    setIsCapturing(true);
    
    try {
      // Try clone method first (more reliable)
      let canvas = await captureWithClone();
      
      // If clone fails, try direct capture
      if (!canvas) {
        canvas = await captureExactFlyer();
      }
      
      if (canvas) {
        return canvas;
      } else {
        throw new Error('Failed to capture screenshot');
      }
    } catch (error) {
      console.error('Screenshot failed:', error);
      alert('Failed to capture screenshot. Please try again.');
      return null;
    } finally {
      setIsCapturing(false);
    }
  };

  const handleDownloadPNG = async () => {
    const canvas = await takeScreenshot();
    if (canvas) {
      const link = document.createElement('a');
      link.download = `nacos-flyer-${Date.now()}.png`;
      link.href = canvas.toDataURL();
      link.click();
    }
  };

  const handleDownloadJPEG = async () => {
    const canvas = await takeScreenshot();
    if (canvas) {
      const link = document.createElement('a');
      link.download = `nacos-flyer-${Date.now()}.jpg`;
      link.href = canvas.toDataURL('image/jpeg', 0.95);
      link.click();
    }
  };

  const handleCopyToClipboard = async () => {
    const canvas = await takeScreenshot();
    if (canvas) {
      canvas.toBlob(async (blob) => {
        if (blob) {
          try {
            await navigator.clipboard.write([
              new ClipboardItem({
                [blob.type]: blob,
              }),
            ]);
            alert('✅ Flyer copied to clipboard!');
          } catch (err) {
            alert('Failed to copy. Try downloading instead.');
          }
        }
      });
    }
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow && flyerCaptureRef.current) {
      const html = flyerCaptureRef.current.outerHTML;
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>NACOS Flyer</title>
            <style>
              @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800;900&family=Inter:wght@300;400;500;600;700&display=swap');
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body { 
                display: flex; 
                justify-content: center; 
                align-items: center; 
                min-height: 100vh;
                background: white;
                font-family: 'Inter', sans-serif;
              }
              @page { size: auto; margin: 20mm; }
              @media print {
                body { margin: 0; padding: 0; }
              }
            </style>
          </head>
          <body>${html}</body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
      printWindow.close();
    } else {
      window.print();
    }
  };

  if (isEditing) {
    return (
      <FlyerAdminPage onSubmit={(flyerData: FlyerData) => handleFlyerDataChange(flyerData)}/>
    );
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800;900&family=Inter:wght@300;400;500;600;700&display=swap');
        .unijos-flyer * { box-sizing: border-box; margin: 0; padding: 0; }
        .unijos-flyer { font-family: 'Inter', sans-serif; }
        
        @media print {
          body * {
            visibility: hidden;
          }
          .flyer-print-container, .flyer-print-container * {
            visibility: visible;
          }
          .flyer-print-container {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div style={{
        minHeight: "100vh",
        background: "#0d0d1a",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 20px",
        position: "relative",
      }}>
        
        {/* Floating Action Buttons */}
        <div className="no-print">
          <div
            onClick={() => showContinuationDropdown(prev => !prev)}
            style={{
              position: 'fixed',
              bottom: 20,
              right: 20,
              width: 56,
              height: 56,
              background: 'linear-gradient(135deg, #667eea, #764ba2)',
              borderRadius: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
              transition: 'transform 0.2s ease',
              zIndex: 100,
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            <Camera color="white" size={24} />
          </div>
          
          {continuationDropdown && (
            <div style={{
              position: 'fixed',
              bottom: 90,
              right: 20,
              background: 'white',
              borderRadius: 12,
              boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
              padding: 8,
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              minWidth: 160,
              zIndex: 100,
              justifyContent:'center',
              alignItems: 'start'
            }}>
              <Button 
                onClick={handlePrint}
                startIcon={<Printer size={16} />}
                sx={{ justifyContent: 'flex-start', textTransform: 'none' }}
              >
                Print Flyer
              </Button>
              <Button 
                onClick={handleDownloadPNG}
                startIcon={<Download size={16} />}
                sx={{ justifyContent: 'flex-start', textTransform: 'none' }}
              >
                Save as PNG
              </Button>
              <Button 
                onClick={handleDownloadJPEG}
                startIcon={<Download size={16} />}
                sx={{ justifyContent: 'flex-start', textTransform: 'none' }}
              >
                Save as JPEG
              </Button>
              <Button 
                onClick={handleCopyToClipboard}
                startIcon={<Copy size={16} />}
                sx={{ justifyContent: 'flex-start', textTransform: 'none' }}
              >
                Copy Screenshot
              </Button>
              <div className="flex justify-between items-center gap-2 w-full">
                <div className="flex justify-center"><DatabaseBackup className="text-blue-400" size={16}/>&nbsp;<h2 className="text-blue-500 text-sm">Should show date?</h2></div> 
                  <Switch checked={date} onChange={(e) => showDate(e.target.checked)}></Switch>
                </div>
              <div className="flex justify-between items-center gap-2 w-full">
                <div className="flex justify-center"><DatabaseBackup className="text-blue-400" size={16}/>&nbsp;<h2 className="text-blue-500 text-sm">Should show venue?</h2></div> 
                  <Switch checked={venue} onChange={(e) => showVenue(e.target.checked)}></Switch>
                </div>
              <Button 
                onClick={() => setIsEditing(true)}
                startIcon={<Edit size={16} />}
                sx={{ justifyContent: 'flex-start', textTransform: 'none' }}
              >
                Back to Edit
              </Button>
            </div>
          )}
        </div>

        {/* Loading Overlay */}
        {isCapturing && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}>
            <div style={{
              background: 'white',
              padding: '30px',
              borderRadius: 20,
              textAlign: 'center',
            }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>📸</div>
              <div style={{ fontWeight: 600 }}>Capturing screenshot...</div>
              <div style={{ fontSize: 12, color: '#666', marginTop: 8 }}>Please wait</div>
            </div>
          </div>
        )}

        {/* Flyer Container - NO SCROLLING, exact copy for capture */}
        <div 
          ref={flyerCaptureRef}
          className="flyer-print-container"
          style={{
            width: 600,
            background: "linear-gradient(165deg, #ffffff 0%, #f1f5f9 40%, #e2e8f0 100%)",
            borderRadius: 20,
            overflow: "hidden",
            boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
            position: "relative",
          }}
        >
          {/* Animated background particles */}
          <div style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            overflow: "hidden",
            pointerEvents: "none",
          }}>
            {[...Array(20)].map((_, i) => (
              <div
                key={i}
                style={{
                  position: "absolute",
                  width: Math.random() * 100 + 50,
                  height: Math.random() * 100 + 50,
                  background: "radial-gradient(circle, rgba(102,126,234,0.1) 0%, transparent 70%)",
                  borderRadius: "50%",
                  top: `${Math.random() * 100}%`,
                  left: `${Math.random() * 100}%`,
                  animation: `float ${Math.random() * 10 + 10}s infinite ease-in-out`,
                  animationDelay: `${Math.random() * 5}s`,
                }}
              />
            ))}
          </div>

          <TopStripes />
          <FlyerHeader uniLogo={flyer.uniLogo} nacosLogo={flyer.nacosLogo} />

          <div style={{ padding: "32px 36px 28px", position: "relative", zIndex: 1 }}>
            <div
              style={{
                display: "inline-block",
                background: "linear-gradient(135deg, rgba(102,126,234,0.1), rgba(118,75,162,0.1))",
                backdropFilter: "blur(10px)",
                color: "#667eea",
                fontSize: 10.5,
                fontWeight: 600,
                letterSpacing: 2,
                textTransform: "uppercase",
                padding: "6px 16px",
                borderRadius: 20,
                marginBottom: 20,
                border: "1px solid rgba(102,126,234,0.3)",
              }}
            >
              {flyer.badgeLabel}
            </div>

            <h2
              style={{
                fontFamily: "'Poppins', sans-serif",
                fontSize: 28,
                fontWeight: 800,
                background: "linear-gradient(135deg, #1a1a2e, #16213e)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                lineHeight: 1.25,
                marginBottom: 16,
                whiteSpace: "pre-line",
              }}
            >
              {flyer.announcementTitle}
            </h2>

            <div
              style={{
                width: 60,
                height: 3,
                background: "linear-gradient(90deg, #667eea, #764ba2, #f093fb)",
                marginBottom: 18,
                borderRadius: 2,
              }}
            />

            <p
              style={{
                fontSize: 14,
                color: "#2d3748",
                lineHeight: 1.75,
                marginBottom: 24,
                whiteSpace: "pre-line",
              }}
            >
              {flyer.bodyText}
            </p>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
                marginBottom: 28,
              }}
            >
              {date && (
                <InfoCard label="📅 Date" value={flyer.date} />) }
              {date && (<InfoCard label="🕐 Time" value={flyer.time} />)}
              {venue && (
                <InfoCard label="📍 Venue" value={flyer.venue} />)}
              {venue && (<InfoCard label="🎯 Target" value={flyer.targetAudience} />)}
            </div>

            <div
              style={{
                background: "linear-gradient(135deg, rgba(26,26,46,0.95), rgba(22,33,62,0.95))",
                backdropFilter: "blur(10px)",
                color: "#fff",
                borderRadius: 16,
                padding: "18px 22px",
                fontSize: 13.5,
                lineHeight: 1.6,
                marginBottom: 24,
                display: "flex",
                alignItems: "flex-start",
                gap: 12,
              }}
            >
              <span style={{ fontSize: 24, flexShrink: 0 }}>💡</span>
              <span>{flyer.actionNote}</span>
            </div>

            <div
              style={{
                borderTop: "1px solid rgba(102,126,234,0.2)",
                paddingTop: 20,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-end",
              }}
            >
              <div>
                <p
                  style={{
                    fontFamily: "'Poppins', sans-serif",
                    fontSize: 16,
                    fontWeight: 700,
                    color: "#1a1a2e",
                    marginBottom: 2,
                  }}
                >
                  {flyer.directorName}
                </p>
                <p style={{ fontSize: 12, color: "#6B7280" }}>{flyer.directorRole}</p>
              </div>
              <div style={{ fontSize: 12, color: "#9CA3AF", textAlign: "right" }}>
                {flyer.month}
                <br />
                Ref: {flyer.referenceNo}
              </div>
            </div>
          </div>

          <div
            style={{
              background: "linear-gradient(135deg, #1a1a2e, #0f3460)",
              padding: "14px 32px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.8)" }}>
              Directorate of Tech &amp; Innovation · Faculty of Computing
            </p>
            <p style={{ fontSize: 11, color: "#a8c0ff", fontWeight: 600 }}>
              {flyer.email}
            </p>
          </div>

          <BottomStripes />
        </div>
      </div>
    </>
  );
};

export default UniJosTechFlyer;