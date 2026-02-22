'use client'
import { Announcement, AnnouncementModal } from "@/app/components/dynamic-modal";
import { useToast } from "@/app/components/toast";
import { CoreService } from "@/app/helpers/api-handler";
import { Ticket } from "@/app/helpers/factories";
import { Button, Fab } from "@mui/material";
import { Loader } from "lucide-react";
import { useState, useEffect } from "react";



const DEPT_COLORS: Record<string, string> = {
  ComputerScience: "#00e5ff",
  DataScience: "#ff6b6b",
  CyberSecurity: "#a78bfa",
  InformationSystems: "#34d399",
  InformationTectnology: "#fbbf24",
  SoftwareEngineering: "#f472b6",
};

type CreateTicketPayload = {
  ticketId: string;
  name: string;
  email: string;
  phone: string;
  price: number;
  department: string;
  purchaseDate: string; // ISO string
};

const formatPrice = (p: number) =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(p);

export default function TicketDashboard() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [search, setSearch] = useState("");
  const [selectedDept, setSelectedDept] = useState("All");
  const [sortField, setSortField] = useState<keyof Ticket>("id");
  const [sortAsc, setSortAsc] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [visible, setVisible] = useState(false);
  const service:CoreService = new CoreService();
  const {addToast} = useToast();
  const [isLoading, setLoading] = useState<boolean>(false);
  const [isRegisterState, setRegisterState] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [formData, setFormData] = useState<CreateTicketPayload>({
    name:'',
    email:'',
    department:'',
    phone:'',
    price:350,
    ticketId:'',
    purchaseDate:''
  });

  const fetchRegisteredStudents = async() => {
    setLoading(true);
    try{
        const res = await service.get('/purchase-ticket/get-registered-students');
        if(res.success){
            if(Array.isArray(res.data)){
                const users = res.data.map((result) => Ticket.fromJson(result));
                setTickets(users);
            }
            addToast(res.message);
           
        }else{
            addToast(res.message);
        }
    }catch(e:any){
        addToast(e);
    }finally{
        setLoading(false);
    }
  }

  useEffect(() => {
    fetchRegisteredStudents();
    setTimeout(() => setVisible(true), 50);
  }, []);

  const departments = [
  "All",
  ...Object.values(
    tickets.reduce((acc: Record<string, string>, ticket) => {
      const key = ticket.department.trim().toLowerCase();
      if (!acc[key]) {
        acc[key] = ticket.department.trim();
      }
      return acc;
    }, {})
  )
];

  const filtered = tickets
  .filter((t) => {
    const q = search.toLowerCase().trim();

    const departmentMatch =
      selectedDept === "All" ||
      t.department?.trim().toLowerCase() ===
        selectedDept.trim().toLowerCase();

    const searchMatch =
      t.name?.toLowerCase().includes(q) ||
      t.ticketId?.toLowerCase().includes(q) ||
      t.email?.toLowerCase().includes(q) ||
      t.department?.toLowerCase().includes(q);

    return departmentMatch && searchMatch;
  })
  .sort((a, b) => {
    const av = a[sortField];
    const bv = b[sortField];

    if (typeof av === "string" && typeof bv === "string") {
      return sortAsc
        ? av.localeCompare(bv)
        : bv.localeCompare(av);
    }

    return sortAsc ? (av as number) - (bv as number) : (bv as number) - (av as number);
  });

  const totalRevenue = filtered.reduce((s, t) => s + t.price, 0);

  const handleSort = (field: keyof Ticket) => {
    if (sortField === field) setSortAsc(!sortAsc);
    else { setSortField(field); setSortAsc(true); }
  };

  const SortIcon = ({ field }: { field: keyof Ticket }) => (
    <span style={{ marginLeft: 4, opacity: sortField === field ? 1 : 0.3, fontSize: 10 }}>
      {sortField === field ? (sortAsc ? "▲" : "▼") : "⇅"}
    </span>
  );

  //========//

  const handleChange = (key: keyof CreateTicketPayload, value: string | number) => {
    setFormData((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const generateTicketId = () =>
    "#" + Math.random().toString(36).substring(2, 8).toUpperCase();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);

    const ticket = generateTicketId();

    const payload: CreateTicketPayload = {
      ...formData,
      ticketId: ticket,
      purchaseDate: new Date().toISOString(),
    };

    try {
      const res = await service.send("/purchase-ticket/api/create-ticket", payload);

      if (res.success) {
        addToast(res.message || "Ticket created successfully!");
        fetchRegisteredStudents();

        // Reset form
        setFormData({
          name: "",
          email: "",
          department: "",
          phone: "",
          price: 0,
          ticketId: "",
          purchaseDate: ""
        });
        setRegisterState(false);
      } else {
        addToast(res.message || "Failed to create ticket");
      }
    } catch (err: any) {
      addToast(err.message || "Error creating ticket");
    }finally{
      setIsProcessing(false);
    }
  };

const announcement:Announcement[] = [
    {
      id:'1',
      title:'Save user details',
      body:'',
      type:'interactive',
      widget: (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 mt-3"
    >
      <input
        type="text"
        placeholder="Full Name"
        value={formData.name}
        onChange={(e) => handleChange("name", e.target.value)}
        className="bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-white/30 outline-none focus:border-white/30 focus:bg-white/8 transition-all duration-200"
        required
      />
      <input
        type="email"
        placeholder="Email"
        value={formData.email}
        onChange={(e) => handleChange("email", e.target.value)}
        className="bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-white/30 outline-none focus:border-white/30 focus:bg-white/8 transition-all duration-200"
        required
      />
      <input
        type="text"
        placeholder="Department"
        value={formData.department}
        onChange={(e) => handleChange("department", e.target.value)}
        className="bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-white/30 outline-none focus:border-white/30 focus:bg-white/8 transition-all duration-200"
        required
      />
      <input
        type="tel"
        placeholder="Phone"
        value={formData.phone}
        onChange={(e) => handleChange("phone", e.target.value)}
        className="bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-white/30 outline-none focus:border-white/30 focus:bg-white/8 transition-all duration-200"
        required
      />
      <input
        type="number"
        placeholder="Price"
        value={formData.price}
        onChange={(e) => handleChange("price", Number(e.target.value) || 0)}
        className="bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-white/30 outline-none focus:border-white/30 focus:bg-white/8 transition-all duration-200"
        required
      />

      <Button type="submit" variant="contained">
        {isProcessing ? (
          <center>
            <Loader className="animate-spin"></Loader>
          </center>
        ) : 'Save Ticket'}
      </Button>
    </form>
  ),
      date: new Date().toISOString()
    }
  ]

  //========//

  

  if(isLoading){
    return (
        <>
        <div className="w-full h-screen inset-0 bg-black/50 transition flex justify-center items-center">
            <center>
            <Loader className="animate-spin"></Loader>
            <div className="mb-2"></div>
            <p>Loading Registered tickets...</p>
             </center>
        </div>
        </>
    )
  }



  if(isRegisterState){
    return (
        <AnnouncementModal announcements={announcement} isOpen={isRegisterState} onClose={() => setRegisterState(false)}/>
    )
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Mono:wght@300;400;500&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        body { background: #080c10; }

        .dash {
          min-height: 100vh;
          background: #080c10;
          color: #e2e8f0;
          font-family: 'DM Mono', monospace;
          padding: 40px;
          opacity: 0;
          transform: translateY(16px);
          transition: opacity 0.6s ease, transform 0.6s ease;
        }
        .dash.visible { opacity: 1; transform: translateY(0); }

        .header {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          margin-bottom: 40px;
          gap: 20px;
          flex-wrap: wrap;
        }
        .title-block h1 {
          font-family: 'Syne', sans-serif;
          font-weight: 800;
          font-size: clamp(28px, 4vw, 42px);
          letter-spacing: -1px;
          line-height: 1;
          color: #fff;
        }
        .title-block h1 span {
          color: #00e5ff;
        }
        .title-block p {
          font-size: 12px;
          color: #64748b;
          margin-top: 6px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .stats-row {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
          gap: 16px;
          margin-bottom: 32px;
        }
        .stat-card {
          background: #0f1822;
          border: 1px solid #1a2535;
          border-radius: 12px;
          padding: 20px;
          position: relative;
          overflow: hidden;
          transition: border-color 0.2s;
        }
        .stat-card:hover { border-color: #00e5ff44; }
        .stat-card::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 2px;
          background: linear-gradient(90deg, #00e5ff, transparent);
        }
        .stat-label {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: #475569;
          margin-bottom: 8px;
        }
        .stat-value {
          font-family: 'Syne', sans-serif;
          font-size: 24px;
          font-weight: 700;
          color: #fff;
        }
        .stat-value.cyan { color: #00e5ff; }

        .controls {
          display: flex;
          gap: 12px;
          margin-bottom: 24px;
          flex-wrap: wrap;
          align-items: center;
        }
        .search-wrap {
          position: relative;
          flex: 1;
          min-width: 200px;
        }
        .search-icon {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          color: #475569;
          font-size: 14px;
          pointer-events: none;
        }
        input[type="text"] {
          width: 100%;
          background: #0f1822;
          border: 1px solid #1a2535;
          border-radius: 8px;
          color: #e2e8f0;
          font-family: 'DM Mono', monospace;
          font-size: 13px;
          padding: 10px 14px 10px 38px;
          outline: none;
          transition: border-color 0.2s;
        }
        input[type="text"]:focus { border-color: #00e5ff55; }
        input[type="text"]::placeholder { color: #334155; }

        .dept-tabs {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .dept-tab {
          background: #0f1822;
          border: 1px solid #1a2535;
          border-radius: 6px;
          color: #64748b;
          font-family: 'DM Mono', monospace;
          font-size: 11px;
          padding: 6px 14px;
          cursor: pointer;
          transition: all 0.15s;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }
        .dept-tab:hover { border-color: #00e5ff44; color: #94a3b8; }
        .dept-tab.active {
          background: #00e5ff14;
          border-color: #00e5ff;
          color: #00e5ff;
        }

        .table-wrap {
          background: #0f1822;
          border: 1px solid #1a2535;
          border-radius: 16px;
          overflow: hidden;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }
        thead tr {
          border-bottom: 1px solid #1a2535;
        }
        th {
          font-family: 'Syne', sans-serif;
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: #475569;
          padding: 14px 20px;
          text-align: left;
          cursor: pointer;
          user-select: none;
          white-space: nowrap;
          transition: color 0.15s;
        }
        th:hover { color: #94a3b8; }
        th.active { color: #00e5ff; }

        tbody tr {
          border-bottom: 1px solid #0d1520;
          cursor: pointer;
          transition: background 0.15s;
          animation: fadeRow 0.4s ease both;
        }
        tbody tr:hover { background: #131e2e; }
        tbody tr:last-child { border-bottom: none; }
        @keyframes fadeRow {
          from { opacity: 0; transform: translateX(-8px); }
          to { opacity: 1; transform: translateX(0); }
        }

        td {
          padding: 14px 20px;
          color: #94a3b8;
          white-space: nowrap;
        }
        td.primary { color: #e2e8f0; font-weight: 500; }
        td.mono { font-family: 'DM Mono', monospace; }

        .ticket-id {
          font-family: 'DM Mono', monospace;
          font-size: 11px;
          color: #00e5ff;
          background: #00e5ff10;
          border: 1px solid #00e5ff22;
          border-radius: 4px;
          padding: 3px 8px;
          display: inline-block;
        }

        .dept-badge {
          font-size: 10px;
          padding: 3px 10px;
          border-radius: 20px;
          font-weight: 500;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          display: inline-block;
        }

        .price-cell {
          font-family: 'Syne', sans-serif;
          font-weight: 600;
          color: #34d399;
        }

        .empty {
          text-align: center;
          padding: 60px;
          color: #334155;
          font-size: 13px;
        }

        .footer-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 14px 20px;
          border-top: 1px solid #1a2535;
          font-size: 11px;
          color: #475569;
          flex-wrap: wrap;
          gap: 8px;
        }
        .footer-bar span.highlight { color: #00e5ff; }

        /* Modal */
        .overlay {
          position: fixed;
          inset: 0;
          background: #000000cc;
          backdrop-filter: blur(6px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 100;
          padding: 20px;
          animation: fadeIn 0.2s ease;
        }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

        .modal {
          background: #0f1822;
          border: 1px solid #1a2535;
          border-radius: 20px;
          width: 100%;
          max-width: 480px;
          overflow: hidden;
          animation: slideUp 0.25s ease;
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .modal-header {
          padding: 24px 28px 20px;
          border-bottom: 1px solid #1a2535;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }
        .modal-header h2 {
          font-family: 'Syne', sans-serif;
          font-size: 18px;
          font-weight: 700;
          color: #fff;
        }
        .modal-header p { font-size: 11px; color: #475569; margin-top: 4px; }
        .close-btn {
          background: #1a2535;
          border: none;
          border-radius: 8px;
          color: #64748b;
          cursor: pointer;
          font-size: 16px;
          width: 32px; height: 32px;
          display: flex; align-items: center; justify-content: center;
          transition: all 0.15s;
          flex-shrink: 0;
        }
        .close-btn:hover { background: #ff6b6b20; color: #ff6b6b; }
        .modal-body { padding: 24px 28px; }
        .detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .detail-item label {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: #475569;
          display: block;
          margin-bottom: 4px;
        }
        .detail-item .val {
          font-size: 13px;
          color: #e2e8f0;
          font-weight: 500;
        }
        .detail-item.full { grid-column: 1 / -1; }
        .detail-item .val.price {
          font-family: 'Syne', sans-serif;
          font-size: 20px;
          font-weight: 700;
          color: #34d399;
        }

        @media (max-width: 700px) {
          .dash { padding: 20px 16px; }
          td, th { padding: 12px 12px; }
          .detail-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className={`dash ${visible ? "visible" : ""}`}>
        <div className="header">
          <div className="title-block">
            <h1>Ticket <span>Registry</span></h1>
            <p>Purchase records · Backend schema v1</p>
          </div>
        </div>

        <div className="stats-row">
          <div className="stat-card">
            <div className="stat-label">Total Tickets</div>
            <div className="stat-value">{filtered.length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total Revenue</div>
            <div className="stat-value cyan">{formatPrice(totalRevenue)}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Avg Price</div>
            <div className="stat-value">{filtered.length ? formatPrice(Math.round(totalRevenue / filtered.length)) : "—"}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Departments</div>
            <div className="stat-value">{new Set(filtered.map((t) => t.department)).size}</div>
          </div>
        </div>

        <div className="controls">
          <div className="search-wrap">
            <span className="search-icon">⌕</span>
            <input
              type="text"
              placeholder="Search by name, ID, email, department…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="dept-tabs">
            {departments.map((d) => (
              <button
                key={d}
                className={`dept-tab ${selectedDept === d ? "active" : ""}`}
                onClick={() => setSelectedDept(d)}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {(["id","ticketId","name","email","phone","department","price","purchaseDate"] as (keyof Ticket)[]).map((f) => (
                  <th
                    key={f}
                    className={sortField === f ? "active" : ""}
                    onClick={() => handleSort(f)}
                  >
                    {f === "ticketId" ? "Ticket ID" : f === "purchaseDate" ? "Date" : f.charAt(0).toUpperCase() + f.slice(1)}
                    <SortIcon field={f} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="empty">No tickets match your filters.</td></tr>
              ) : (
                filtered.map((t, i) => (
                  <tr
                    key={t.id}
                    style={{ animationDelay: `${i * 40}ms` }}
                    onClick={() => setSelectedTicket(t)}
                  >
                    <td className="mono" style={{ color: "#475569" }}>#{t.id}</td>
                    <td><span className="ticket-id">{t.ticketId}</span></td>
                    <td className="primary">{t.name}</td>
                    <td>{t.email}</td>
                    <td>{t.phone}</td>
                    <td>
                      <span
                        className="dept-badge"
                        style={{
                          color: DEPT_COLORS[t.department] ?? "#94a3b8",
                          background: (DEPT_COLORS[t.department] ?? "#94a3b8") + "18",
                          border: `1px solid ${(DEPT_COLORS[t.department] ?? "#94a3b8")}33`,
                        }}
                      >
                        {t.department}
                      </span>
                    </td>
                    <td className="price-cell">{formatPrice(t.price)}</td>
                    <td>{t.purchaseDate}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <div className="footer-bar">
            <span>Showing <span className="highlight">{filtered.length}</span> of {tickets.length} records</span>
            <span>Sorted by <span className="highlight">{sortField}</span> · {sortAsc ? "ascending" : "descending"}</span>
          </div>
        </div>
      </div>

      {selectedTicket && (
        <div className="overlay" onClick={() => setSelectedTicket(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2>{selectedTicket.name}</h2>
                <p><span className="ticket-id">{selectedTicket.ticketId}</span></p>
              </div>
              <button className="close-btn" onClick={() => setSelectedTicket(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="detail-grid">
                <div className="detail-item full">
                  <label>Price Paid</label>
                  <div className="val price">{formatPrice(selectedTicket.price)}</div>
                </div>
                <div className="detail-item">
                  <label>Email</label>
                  <div className="val">{selectedTicket.email}</div>
                </div>
                <div className="detail-item">
                  <label>Phone</label>
                  <div className="val">{selectedTicket.phone}</div>
                </div>
                <div className="detail-item">
                  <label>Department</label>
                  <div className="val">
                    <span
                      className="dept-badge"
                      style={{
                        color: DEPT_COLORS[selectedTicket.department] ?? "#94a3b8",
                        background: (DEPT_COLORS[selectedTicket.department] ?? "#94a3b8") + "18",
                        border: `1px solid ${(DEPT_COLORS[selectedTicket.department] ?? "#94a3b8")}33`,
                      }}
                    >
                      {selectedTicket.department}
                    </span>
                  </div>
                </div>
                <div className="detail-item">
                  <label>Purchase Date</label>
                  <div className="val">{selectedTicket.purchaseDate}</div>
                </div>
                <div className="detail-item">
                  <label>Record ID</label>
                  <div className="val" style={{ color: "#475569" }}>#{selectedTicket.id}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
      )}
      <Fab
  title="Add"
  onClick={() => setRegisterState(true)}
  style={{
    position: "fixed",
    bottom: "24px",
    right: "24px",
    zIndex: 200,
    backgroundColor: 'darkblue',
    boxShadow:'0px 4px 8px rgba(0,0,0,0.5)'
  }}
></Fab>
    </>
  );
}