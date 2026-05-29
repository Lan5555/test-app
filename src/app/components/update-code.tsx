import { ArrowRight, Loader, Plus, Search, User, Hash, RefreshCw, X } from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import { useToast } from "./toast";
import { CoreService } from "../helpers/api-handler";
import { Users } from "../helpers/factories";

interface props{
    isOpen:boolean;
    isLoading: boolean;
    onClose: () => void;
    onSubmit: (e:any, id:number, code:string, attempt:number) => Promise<void>
}
const UpdateUserCode:React.FC<props> = ({isOpen,onClose,onSubmit, isLoading}) => {
    const [code, setCode] = useState('');
    const [id, setId] = useState<number>(0);
    const [attempt, setAttempt] = useState<number>(0);
    const [searchTerm, setSearchTerm] = useState('');
    const [users, setUsers] = useState<Users[]>([]);
    const {addToast} = useToast();
    const attemptsList:number[] = [1,2,3,4,5,6,7,8,9,10];
    const service:CoreService = new CoreService();
    const fetchUsers = async() => {
        try{
            const res = await service.get('/users/api/find-all-users');
            if(res.success){
                setUsers(res.data!.map((u:any) => Users.fromJson(u)));
                addToast('Users queried','success');
            }else{
                addToast('failed to get users','warning');
            }
        }catch(e:any){
            addToast(e,'warning');
        }
    }
    useEffect(() => {fetchUsers()},[]);

    const filteredUsers = useMemo(() => {
        return users.filter(u => 
            u.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
            u.id.toString().includes(searchTerm)
        );
    }, [users, searchTerm]);

    if(!isOpen) return null;
    
    return <>
        <div className="flex justify-center items-center inset-0 bg-black/60 backdrop-blur-sm w-full h-screen fixed top-0 left-0 z-50 p-4">
         <form 
          onSubmit={async (e) => {
            await onSubmit(e, id, code, attempt);
            onClose();
          }}
         className="flex bg-white rounded-4xl w-full max-w-md max-h-[90vh] relative flex-col shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="p-6 bg-indigo-600 text-white flex justify-between items-center">
                <div>
                    <h3 className="text-xl font-bold">Update Access Code</h3>
                    <p className="text-indigo-100 text-xs">Modify student credentials and attempts</p>
                </div>
                <button type="button" onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-colors">
                    <X className="w-6 h-6" />
                </button>
            </div>

            <div className="p-6 flex flex-col gap-5 overflow-y-auto">
                {/* Search and List */}
                <div className="space-y-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input 
                            type="text" 
                            placeholder="Search by name or ID..." 
                            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="h-40 border border-slate-100 rounded-xl overflow-y-auto bg-slate-50/50 p-2 space-y-2">
                        {filteredUsers.map((user) => (
                            <div key={user.id} 
                                 onClick={() => setId(user.id)}
                                 className={`p-3 rounded-lg border transition-all cursor-pointer ${id === user.id ? 'bg-indigo-50 border-indigo-200 shadow-sm' : 'bg-white border-transparent hover:border-slate-200'}`}>
                                <div className="flex justify-between items-center">
                                    <span className="font-bold text-slate-800 text-sm">{user.name}</span>
                                    <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-500">ID: {user.id}</span>
                                </div>
                                <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                                    <RefreshCw className="w-3 h-3" /> Attempts: {user.codeInfo?.attempts || 0}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Inputs */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">User ID</label>
                        <input className="w-full rounded-xl bg-slate-50 border border-slate-200 p-3 text-sm text-slate-900 outline-none focus:border-indigo-500" placeholder="ID" value={id || ''} onChange={(e) => setId(+e.target.value)} required />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">New Code</label>
                        <input className="w-full rounded-xl bg-slate-50 border border-slate-200 p-3 text-sm text-slate-900 outline-none focus:border-indigo-500 font-mono" placeholder="ABC123" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={6} required />
                    </div>
                </div>

                <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Set Attempts</label>
                    <select className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 outline-none focus:border-indigo-500" onChange={(e) => setAttempt(+e.target.value)} value={attempt}>
                        {attemptsList.map((val) => (
                            <option key={val} value={val}>{val} {val === 1 ? 'Attempt' : 'Attempts'}</option>
                        ))}
                    </select>
                </div>

                <button 
                    className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl shadow-lg shadow-indigo-200 transition-all active:scale-[0.98] flex justify-center items-center gap-2 mt-2 disabled:opacity-50" 
                    type="submit"
                    disabled={isLoading || !id || !code}
                >
                    {isLoading ? <Loader className="w-5 h-5 animate-spin" /> : <><Plus className="w-5 h-5" /> Update User</>}
                </button>
            </div>
        </form>
        </div>
    </>
}
export default UpdateUserCode;