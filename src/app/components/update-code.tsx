import { ArrowRight, Backpack, Loader, LucidePanelRightClose, Plus, SkipBack } from "lucide-react";
import { useEffect, useState } from "react";
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
    if(!isOpen) return;
    
    return <>
        <div className="flex justify-center items-center inset-0 bg-black/50 w-full h-screen fixed top-0 bottom-0 left-0 right-0 flex-col z-50">
         <form 
          onSubmit={(e) => onSubmit(e, id,code, attempt)}
         className="flex justify-center items-center p-8 shadow bg-white rounded-2xl w-80 h-96 relative flex-col gap-6">
            <div className="p-2 flex justify-center items-center rounded bg-blue-50 border border-blue-700 w-58">
            <h3 className="text-black">Update user code</h3>
            </div>
            <ArrowRight onClick={() => onClose()} className="absolute top-2 right-2 text-black"></ArrowRight>
            <div className="max-h-52 overflow-y-auto w-full text-black text-sm">
            {users.map((user) => (
                <ul key={user.id} className="mb-2">
                <li>Name: {user.name}</li>
                <li>User ID: {user.id}</li>
                <li>Attempts: {user.codeInfo?.attempts}</li>
                </ul>
            ))}
        </div>

            <label htmlFor={'input'} className="text-sm text-start text-red-500">Required *</label>
            <div className="flex justify-around items-center gap-5">
            <input id={'input'} className="rounded placeholder:text-black outline-none w-full bg-transparent p-2 shadow text-sm border text-black" placeholder={'Enter Id'} onChange={(e:any) => setId(+e.target.value)} maxLength={3} required></input>
            <input id={'input'} className="rounded placeholder:text-black outline-none w-full bg-transparent p-2 shadow text-sm border text-black" placeholder={'Enter code'} onChange={(e:any) => setCode(e.target.value)} maxLength={6} required></input>
            </div>
            <select className="w-full p-1 rounded shadow text-black" onChange={(e) => setAttempt(+e.target.value)} value={attempt}>
                {attemptsList.map((attempts, index) => (
                    <option key={index}>{attempts}</option>
                ))}
            </select>
        <button className="rounded-2xl p-2 w-9/12 bg-linear-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold flex justify-center items-center" type={'submit'}>
        {isLoading ? (<Loader className="w-4 h-4 animate-spin"></Loader>):(<><Plus></Plus>&nbsp; Submit</>)}
        </button>
        </form>
        </div>
    </>
}
export default UpdateUserCode;