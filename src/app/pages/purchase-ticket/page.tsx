'use client';
import { Announcement, AnnouncementModal } from "@/app/components/dynamic-modal";
import { InitializePayment } from "@/app/components/payment";
import { useToast } from "@/app/components/toast";
import { CoreService } from "@/app/helpers/api-handler";
import { Ticket } from "@/app/helpers/factories";
import { Loader } from "lucide-react";
import { useState, useRef, useEffect } from "react";

type FormData = {
  name: string;
  email: string;
  phone: string;
  ticketType: "vip" | "general" | "early";
  department: string;
};

type TicketType = {
  label: string;
  price: string;
  color: string;
  accent: string;
};

const TICKET_TYPES: Record<string, TicketType> = {
  // general: { label: "General Admission", price: "$49", color: "#1a1a2e", accent: "#e94560" },
  // early: { label: "Early Bird", price: "$29", color: "#0f3460", accent: "#f5a623" },
  vip: { label: "Regular", price: "₦350", color: "#16213e", accent: "#00d4aa" },
};

const generateTicketId = () =>
  "#" + Math.random().toString(36).substring(2, 8).toUpperCase();

const QRPattern = ({ size = 80 }: { size?: number }) => {
  const cells = Array.from({ length: 7 }, (_, r) =>
    Array.from({ length: 7 }, (_, c) => {
      if ((r < 3 && c < 3) || (r < 3 && c > 3) || (r > 3 && c < 3)) return 1;
      return Math.random() > 0.5 ? 1 : 0;
    })
  );
  const cell = size / 7;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {cells.map((row, r) =>
        row.map((val, c) =>
          val ? (
            <rect
              key={`${r}-${c}`}
              x={c * cell}
              y={r * cell}
              width={cell - 1}
              height={cell - 1}
              fill="currentColor"
            />
          ) : null
        )
      )}
    </svg>
  );
};

const TicketView = ({
  data,
  ticketId,
  onBack,
}: {
  data: FormData;
  ticketId: string;
  onBack: () => void;
}) => {
  const ticket = TICKET_TYPES[data.ticketType];
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setTimeout(() => setVisible(true), 50);
  }, []);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "32px",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(40px)",
        transition: "all 0.7s cubic-bezier(0.34, 1.56, 0.64, 1)",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            fontSize: "48px",
            marginBottom: "8px",
            animation: "bounce 0.6s ease 0.3s both",
          }}
        >
          🎉
        </div>
        <h2
          style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: "28px",
            color: "#fff",
            margin: 0,
            letterSpacing: "-0.5px",
          }}
        >
          You're in!
        </h2>
        <p style={{ color: "rgba(255,255,255,0.5)", margin: "8px 0 0", fontSize: "14px" }}>
          Your ticket has been generated
        </p>
      </div>

      {/* Ticket */}
      <div
        style={{
          width: "340px",
          background: ticket.color,
          borderRadius: "20px",
          overflow: "hidden",
          boxShadow: `0 0 60px ${ticket.accent}40, 0 20px 60px rgba(0,0,0,0.5)`,
          border: `1px solid ${ticket.accent}30`,
          transform: visible ? "rotate(-1deg)" : "rotate(-5deg) scale(0.8)",
          transition: "transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) 0.2s",
        }}
      >
        {/* Header */}
        <div
          style={{
            background: `linear-gradient(135deg, ${ticket.accent}20, ${ticket.accent}05)`,
            padding: "24px 24px 20px",
            borderBottom: `1px dashed ${ticket.accent}40`,
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: "-30px",
              right: "-30px",
              width: "120px",
              height: "120px",
              borderRadius: "50%",
              background: `${ticket.accent}15`,
            }}
          />
          <div
            style={{
              fontSize: "11px",
              letterSpacing: "4px",
              textTransform: "uppercase",
              color: ticket.accent,
              marginBottom: "6px",
            }}
          >
            ✦ ADMISSION TICKET
          </div>
          <div
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: "22px",
              color: "#fff",
              fontWeight: "700",
              lineHeight: 1.2,
            }}
          >
            Campus Clash: The Hunt Begins
            <br />
            <span style={{ fontSize: "14px", fontWeight: "400", color: "rgba(255,255,255,0.6)" }}>
              2026 Edition
            </span>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: "20px 24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ flex: 1 }}>
              <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "10px", letterSpacing: "2px", marginBottom: "4px" }}>
                ATTENDEE
              </div>
              <div style={{ color: "#fff", fontSize: "18px", fontFamily: "'Playfair Display', serif", fontWeight: "600" }}>
                {data.name}
              </div>
              <div style={{ color: "rgba(255,255,255,0.5)", fontSize: "12px", marginTop: "3px" }}>
                {data.email}
              </div>

              <div style={{ marginTop: "16px", display: "flex", gap: "24px" }}>
                <div>
                  <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "10px", letterSpacing: "2px" }}>DATE</div>
                  <div style={{ color: "#fff", fontSize: "13px", marginTop: "2px" }}>{new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</div>
                </div>
                <div>
                  <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "10px", letterSpacing: "2px" }}>TYPE</div>
                  <div style={{ color: ticket.accent, fontSize: "13px", marginTop: "2px", fontWeight: "600" }}>
                    {/* {ticket.label.toUpperCase()} */} VIP
                  </div>
                </div>
              </div>
            </div>

            {/* QR */}
            <div
              style={{
                background: "#fff",
                borderRadius: "12px",
                padding: "10px",
                color: ticket.color,
              }}
            >
              <QRPattern size={72} />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            borderTop: `1px dashed ${ticket.accent}40`,
            padding: "14px 24px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "10px", letterSpacing: "2px" }}>TICKET ID</div>
            <div
              style={{
                color: ticket.accent,
                fontSize: "14px",
                fontFamily: "monospace",
                letterSpacing: "2px",
                marginTop: "2px",
              }}
            >
              {ticketId}
            </div>
          </div>
          <div
            style={{
              fontSize: "22px",
              fontFamily: "'Playfair Display', serif",
              fontWeight: "700",
              color: "#fff",
            }}
          >
            {ticket.price}
          </div>
        </div>

        {/* Punched holes */}
        <div style={{ position: "relative", height: "0" }}>
          <div
            style={{
              position: "absolute",
              left: "-12px",
              top: "-150px",
              width: "24px",
              height: "24px",
              borderRadius: "50%",
              background: "#0d0d1a",
              border: `1px solid ${ticket.accent}20`,
            }}
          />
          <div
            style={{
              position: "absolute",
              right: "-12px",
              top: "-150px",
              width: "24px",
              height: "24px",
              borderRadius: "50%",
              background: "#0d0d1a",
              border: `1px solid ${ticket.accent}20`,
            }}
          />
        </div>
      </div>

      <button
        onClick={onBack}
        style={{
          background: "transparent",
          border: "1px solid rgba(255,255,255,0.2)",
          color: "rgba(255,255,255,0.6)",
          padding: "12px 28px",
          borderRadius: "100px",
          cursor: "pointer",
          fontSize: "13px",
          letterSpacing: "1px",
          transition: "all 0.2s",
        }}
        onMouseEnter={(e) => {
          (e.target as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.5)";
          (e.target as HTMLButtonElement).style.color = "#fff";
        }}
        onMouseLeave={(e) => {
          (e.target as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.2)";
          (e.target as HTMLButtonElement).style.color = "rgba(255,255,255,0.6)";
        }}
      >
        PRINT TICKET
      </button>

      <style>{`
        @keyframes bounce {
          0% { transform: scale(0) rotate(-10deg); opacity: 0; }
          70% { transform: scale(1.2) rotate(5deg); }
          100% { transform: scale(1) rotate(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default function EventRegistration() {
  const [form, setForm] = useState<FormData>({
    name: "",
    email: "",
    phone: "",
    department: "",
    ticketType: "vip",
  });
  const [stage, setStage] = useState<"form" | "paying" | "ticket">("form");
  const [errors, setErrors] = useState<Partial<FormData>>({});
  const [ticketId, setTicketId] = useState("");
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const {addToast} = useToast();
  const service:CoreService = new CoreService();
  const [payment, setPayment] = useState<boolean>(false);
  const [open, setOpen] = useState(false);
  const [isServerAwake, setServerAwake] = useState(false);

  //======= Query ticket states =======//
  const [isDisplayingTicket, setDisplayingTicket] = useState(false);
  const [ticketDetails, setTicketDetails] = useState<Ticket | null>(null);
  const [isQuerying, setQuerying] = useState(false);
  const [ticketQueryId, setTicketQueryId] = useState("");
  const [isProcessingQuery, setProcessingQuery] = useState(false);
  const [queryError, setQueryError] = useState<string | null>(null);

  const validate = () => {
    const e: Partial<FormData> = {};
    if (!form.name.trim()) e.name = "Name required";
    if (!form.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) e.email = "Valid email required";
    if (!form.phone.match(/^\+?[\d\s\-()]{7,}$/)) e.phone = "Valid phone required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const getTicketDetails = async (ticketId:string) => {
    setProcessingQuery(true);
    if(!ticketId.includes("#")){
      setQueryError("Invalid ticket ID format. It should start with '#'.");
      setProcessingQuery(false);
      return null;
    }
    try{
      const splitTicket = ticketId.substring(1);
      const res = await service.get(`/purchase-ticket/api/get-tickets?ticketId=${splitTicket}`);
      if(res.success){
        const result = Array.isArray(res.data) && res.data.length > 0 ? Ticket.fromJson(res.data[0]) : null;
        setTicketDetails(result);
        setDisplayingTicket(true);
        addToast(res.message || "Ticket details fetched successfully!");
      }else{
        setQueryError(res.message || "Failed to fetch ticket details");
      }
    }catch(err:any){
      addToast("Error fetching ticket details: " + (err.message || "Unknown error"));
      return null;
    }finally{
      setProcessingQuery(false);
    }
  }

  const wakeServer = async () => {
    try{
      const res = await service.get('/users/api/ping-server');
      if(res.success){
      setServerAwake(true);
      }else{
        addToast("Unable to connect to server. Please try again later.");
      }
    }catch(err){
      console.error("Failed to wake server:", err);
    }
  }

  const handleCreateTicket = async() => {
    const ticket = generateTicketId();
    setTicketId(ticket);
    try{
      const res = await service.send('/purchase-ticket/api/create-ticket',{
        ticketId: ticket,
        name: form.name,
        email: form.email,
        phone: form.phone,
        price: 350,
        department: form.department,
        purchaseDate: new Date().toISOString(),
      });
      if(res.success){
        addToast(res.message || "Ticket created successfully!");
        setPayment(false);
        setStage("ticket");
      }else{
        addToast("Failed to create ticket: " + (res.message || "Unknown error"));
      }
    }catch(err:any){
      addToast("Error creating ticket: " + (err.message || "Unknown error"));
    }
  }

  useEffect(() => {
    setOpen(true);
    wakeServer();
  },[])

  const handlePurchase = async () => {
    if (!validate()) return;
    setStage("paying");
    await new Promise((res) => setTimeout(res, 1500)); // Simulate processing delay
    setPayment(true);
    setStage("form");
  };



  const handleBack = () => {
    window.print();
  };

  const activeTicket = TICKET_TYPES[form.ticketType];
  const announcement:Announcement[] = [
    {
      id: "1",
      title: "Campus Clash 2026: Early Bird Tickets Now Available!",
      body: "Get ready for an action-packed treasure hunt designed to test your intelligence, creativity, and teamwork. Freshers will be grouped into teams and sent on a thrilling campus-wide adventure where every clue leads closer to victory. Participants will solve challenging riddles, complete engaging tasks, and navigate strategic checkpoints scattered across the school environment.",
      date: new Date().toISOString(),
    },
    {
      id:"2",
      title: "Exciting Prizes Await at Campus Clash 2026!",
      body: "The top three teams will win amazing prizes, including cash rewards, exclusive merchandise, and VIP access to future events. Don't miss your chance to be part of this unforgettable experience!",
      date: new Date().toISOString(),
    },
    {
      id:"3",
      title: "Join the Ultimate Campus Adventure - Register Now for Campus Clash 2026!",
      body: "It’s more than just a hunt — it’s the official kickoff to unity, discovery, and the ultimate campus experience. 🚀",
      date: new Date().toISOString(),
      cta:{label:"Register Now", onClick:() => setOpen(false)}
    }
  ]

  const ticketQueryModalAnnouncement:Announcement[] = [
    {
      id: "query-1",
      title: "Querying Ticket Information",
      body: "",
      type:'interactive',
      widget: (
        <form style={{display:"flex", flexDirection:"column", gap:"12px"}} onSubmit={ async (e) => {e.preventDefault(); await getTicketDetails(ticketQueryId);}}>
          <input type="text" placeholder="Enter your ticket ID" style={{padding:"10px", borderRadius:"8px", border:"1px solid rgba(255,255,255,0.1)"}} maxLength={7} onChange={(e) => setTicketQueryId(e.target.value)} required/>
          {queryError && <p style={{color:"rgba(255,100,100,0.8)", fontSize:"12px"}}>{queryError}</p>}
          <button style={{padding:"10px", borderRadius:"8px", background:"linear-gradient(135deg, #00d4aa20, #00d4aa05)", color:"#fff"}} type={'submit'} disabled={isProcessingQuery}>{isProcessingQuery ? 
          <center>
            <Loader className="animate-spin"></Loader>
          </center>
             : "Fetch Ticket Details"}
            </button>
        </form>
      ),
      date: new Date().toISOString(),
    },{
      id:"query-2",
      title: "How to Find Your Ticket ID",
      body: "Your Ticket ID is a unique identifier for your purchase. The Ticket ID starts with a '#' followed by 6 alphanumeric characters (e.g., #A1B2C3). Please enter the Ticket ID in the format shown when querying your ticket details.",
      date: new Date().toISOString(),
      cta:{label:"Request ticket ID", onClick:() => {
        setOpen(false);
        window.location.href = "http://wa.me/09065590812?text=Hello%2C%20I%20would%20like%20to%20request%20my%20ticket%20ID%20for%20Campus%20Clash%202026.";
      }}
    }
  ];



  const generateTicketButton = (text: string, onClick: () => void, sub: string) => {
    return (
      <button
                    
                    onClick={onClick}
                    style={{
                      background:  "linear-gradient(135deg, rgba(0,0,0,0.2), #00d4aa05)",
                      border: `1px solid rgba(255,255,255,0.1)`,
                      borderRadius: "12px",
                      padding: "12px 8px",
                      cursor: "pointer",
                      transition: "all 0.25s ease",
                      textAlign: "center",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "11px",
                        fontWeight: "600",
                        color: "rgba(255,255,255,0.5)",
                        letterSpacing: "0.5px",
                        marginBottom: "3px",
                        transition: "color 0.25s",
                      }}
                    >
                      {text}
                    </div>
                    <div
                      style={{
                        fontSize: "10px",
                        color: "rgba(255,255,255,0.7)",
                        transition: "color 0.25s",
                      }}
                    >
                      {sub}
                    </div>
                  </button>
    )
  }

  if(!isServerAwake){
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#0d0d1a",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "20px",
          fontFamily: "'DM Sans', sans-serif",
          color: "#fff",
          flexDirection: "column",
          gap: "20px",
        }}
      >
        <div
          style={{
            display: "inline-block",
            width: "16px",
            height: "16px",
            border: "2px solid rgba(255,255,255,0.3)",
            borderTopColor: "#fff",
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
          }}
        />
        Waking up the server...
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); } 
          }
        `}</style>
      </div>
    )
  }

  if(isDisplayingTicket){
    const getData: FormData = {
      email: ticketDetails?.email || "",
      name: ticketDetails?.name || "",
      phone: ticketDetails?.phone || "",
      department: ticketDetails?.department || "",
      ticketType: "vip",
    }
    return <TicketView data={getData} ticketId={ticketDetails?.ticketId!} onBack={handleBack} />
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0d0d1a",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 20px",
        fontFamily: "'DM Sans', sans-serif",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {isQuerying && (<AnnouncementModal announcements={ticketQueryModalAnnouncement} isOpen={true} onClose={() => setQuerying(false)}></AnnouncementModal>)}
      <AnnouncementModal announcements={announcement} isOpen={open} onClose={() => setOpen(false)}></AnnouncementModal>
      {payment && (
          <div className='flex justify-center items-center inset-0 bg-black/50 fixed top-[50%] left-[50%] w-full h-screen transform-[translate(-50%,-50%)]'>
          <InitializePayment name={form.name} email={form.email} amount={350} phone={form.phone} callback={async() => await handleCreateTicket()} onClose={() => setPayment(false)} title={"Campus Clash 2026 Ticket Purchase"}></InitializePayment>
        </div>
      )}
      {/* Background orbs */}
      <div
        style={{
          position: "absolute",
          top: "-20%",
          left: "-10%",
          width: "600px",
          height: "600px",
          borderRadius: "50%",
          background: `radial-gradient(circle, ${activeTicket.accent}15 0%, transparent 70%)`,
          transition: "background 0.8s ease",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "-20%",
          right: "-10%",
          width: "500px",
          height: "500px",
          borderRadius: "50%",
          background: `radial-gradient(circle, ${activeTicket.accent}10 0%, transparent 70%)`,
          transition: "background 0.8s ease",
          pointerEvents: "none",
        }}
      />

      {/* Noise texture */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.03'/%3E%3C/svg%3E")`,
          opacity: 0.4,
          pointerEvents: "none",
        }}
      />

      <link
        href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Playfair+Display:wght@400;600;700&display=swap"
        rel="stylesheet"
      />

      <div style={{ width: "100%", maxWidth: "440px", position: "relative", zIndex: 1 }}>
        {stage === "ticket" ? (
          <TicketView data={form} ticketId={ticketId} onBack={handleBack} />
        ) : (
          <div
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: "24px",
              padding: "40px",
              backdropFilter: "blur(20px)",
              boxShadow: "0 40px 80px rgba(0,0,0,0.4)",
              display: payment ? "none" : "block",
            }}
          >
            {/* Header */}
            <div style={{ marginBottom: "36px" }}>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  background: `${activeTicket.accent}15`,
                  border: `1px solid ${activeTicket.accent}30`,
                  borderRadius: "100px",
                  padding: "6px 14px",
                  marginBottom: "20px",
                  transition: "all 0.5s ease",
                }}
              >
                <div
                  style={{
                    width: "6px",
                    height: "6px",
                    borderRadius: "50%",
                    background: activeTicket.accent,
                    boxShadow: `0 0 8px ${activeTicket.accent}`,
                    animation: "pulse 2s infinite",
                  }}
                />
                <span
                  style={{
                    fontSize: "11px",
                    letterSpacing: "3px",
                    textTransform: "uppercase",
                    color: activeTicket.accent,
                    transition: "color 0.5s ease",
                  }}
                >
                  LIVE REGISTRATION
                </span>
              </div>
              <h1
                style={{
                  fontFamily: "'Playfair Display', serif",
                  fontSize: "32px",
                  color: "#fff",
                  margin: "0 0 8px",
                  lineHeight: 1.2,
                  letterSpacing: "-0.5px",
                }}
              >
                Campus Clash: The Hunt Begins
                <br />
                <span style={{ color: activeTicket.accent, transition: "color 0.5s" }}>2026</span>
              </h1>
              <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "14px", margin: 0 }}>
                Join us for an unforgettable day of fun, learning, and networking at the 2026 edition of Campus Clash!
              </p>
            </div>

            {/* Ticket type selector */}
            <div style={{ marginBottom: "28px" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "11px",
                  letterSpacing: "2px",
                  color: "rgba(255,255,255,0.4)",
                  marginBottom: "10px",
                  textTransform: "uppercase",
                }}
              >
                Ticket Type
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
                {(Object.entries(TICKET_TYPES) as [string, TicketType][]).map(([key, val]) => (
                  <button
                    key={key}
                    onClick={() => setForm((f) => ({ ...f, ticketType: key as FormData["ticketType"] }))}
                    style={{
                      background: form.ticketType === key ? `${val.accent}15` : "transparent",
                      border: `1px solid ${form.ticketType === key ? val.accent : "rgba(255,255,255,0.1)"}`,
                      borderRadius: "12px",
                      padding: "12px 8px",
                      cursor: "pointer",
                      transition: "all 0.25s ease",
                      textAlign: "center",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "11px",
                        fontWeight: "600",
                        color: form.ticketType === key ? val.accent : "rgba(255,255,255,0.5)",
                        letterSpacing: "0.5px",
                        marginBottom: "3px",
                        transition: "color 0.25s",
                      }}
                    >
                      {val.price}
                    </div>
                    <div
                      style={{
                        fontSize: "10px",
                        color: form.ticketType === key ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.3)",
                        transition: "color 0.25s",
                      }}
                    >
                      {key === "early" ? "Early Bird" : key === "vip" ? "VIP" : "General"}
                    </div>
                  </button>
                ))}
                {generateTicketButton("Query transaction", () => setQuerying(true), "ticket ID")}
              </div>
            </div>

            {/* Form fields */}
            {(
              [
                { key: "name", label: "Full Name", type: "text", placeholder: "Jane Doe" },
                { key: "email", label: "Email", type: "email", placeholder: "jane@example.com" },
                {key: "department", label: "Department", type: "text", placeholder: "e.g Computer Science"},
                { key: "phone", label: "Phone", type: "tel", placeholder: "08010000000" },
              ] as const
            ).map(({ key, label, type, placeholder }) => (
              <div key={key} style={{ marginBottom: "20px" }}>
                <label
                  style={{
                    display: "block",
                    fontSize: "11px",
                    letterSpacing: "2px",
                    color: "rgba(255,255,255,0.4)",
                    marginBottom: "8px",
                    textTransform: "uppercase",
                  }}
                >
                  {label}
                </label>
                <input
                  type={type}
                  placeholder={placeholder}
                  value={form[key]}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, [key]: e.target.value }));
                    if (errors[key]) setErrors((er) => ({ ...er, [key]: undefined }));
                  }}
                  onFocus={() => setFocusedField(key)}
                  onBlur={() => setFocusedField(null)}
                  style={{
                    width: "100%",
                    background: "rgba(255,255,255,0.05)",
                    border: `1px solid ${
                      errors[key]
                        ? "#ff4d6d"
                        : focusedField === key
                        ? activeTicket.accent
                        : "rgba(255,255,255,0.1)"
                    }`,
                    borderRadius: "12px",
                    padding: "14px 16px",
                    color: "#fff",
                    fontSize: "15px",
                    outline: "none",
                    transition: "border-color 0.25s, box-shadow 0.25s",
                    boxSizing: "border-box",
                    boxShadow:
                      focusedField === key ? `0 0 0 3px ${activeTicket.accent}20` : "none",
                    fontFamily: "'DM Sans', sans-serif",
                  }}
                />
                {errors[key] && (
                  <div
                    style={{
                      color: "#ff4d6d",
                      fontSize: "12px",
                      marginTop: "6px",
                    }}
                  >
                    {errors[key]}
                  </div>
                )}
              </div>
            ))}

            {/* Purchase button */}
            <button
              onClick={handlePurchase}
              disabled={stage === "paying"}
              style={{
                width: "100%",
                padding: "16px",
                background: stage === "paying"
                  ? `${activeTicket.accent}80`
                  : `linear-gradient(135deg, ${activeTicket.accent}, ${activeTicket.accent}cc)`,
                border: "none",
                borderRadius: "14px",
                color: "#fff",
                fontSize: "15px",
                fontWeight: "600",
                letterSpacing: "1px",
                cursor: stage === "paying" ? "not-allowed" : "pointer",
                marginTop: "8px",
                transition: "all 0.3s ease",
                boxShadow: stage === "paying" ? "none" : `0 8px 30px ${activeTicket.accent}40`,
                fontFamily: "'DM Sans', sans-serif",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "10px",
              }}
              onMouseEnter={(e) => {
                if (stage !== "paying") {
                  (e.target as HTMLButtonElement).style.transform = "translateY(-2px)";
                  (e.target as HTMLButtonElement).style.boxShadow = `0 12px 40px ${activeTicket.accent}60`;
                }
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLButtonElement).style.transform = "translateY(0)";
                (e.target as HTMLButtonElement).style.boxShadow = `0 8px 30px ${activeTicket.accent}40`;
              }}
            >
              {stage === "paying" ? (
                <>
                  <span
                    style={{
                      display: "inline-block",
                      width: "16px",
                      height: "16px",
                      border: "2px solid rgba(255,255,255,0.3)",
                      borderTopColor: "#fff",
                      borderRadius: "50%",
                      animation: "spin 0.8s linear infinite",
                    }}
                  />
                  PROCESSING...
                </>
              ) : (
                <>
                  🎟 PURCHASE TICKET — {activeTicket.price}
                </>
              )}
            </button>

            <p style={{ textAlign: "center", color: "rgba(255,255,255,0.25)", fontSize: "12px", marginTop: "16px" }}>
              🔒 Secured with 256-bit encryption <br></br>- Director of tech and innovation.
            </p>
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        input::placeholder {
          color: rgba(255,255,255,0.2);
        }
      `}</style>
    </div>
  );
}
