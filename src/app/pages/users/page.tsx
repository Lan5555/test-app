'use client'
import React, { useEffect, useState } from 'react';
import { Trash2, Edit2, Copy, TrendingUp, Target, Users, Zap, Search, Filter, CheckCircle2, AlertCircle, Save, Loader, SkipBack, LogOut } from 'lucide-react';
import { Users as Person } from '@/app/helpers/factories';
import { CoreService } from '@/app/helpers/api-handler';
import { useToast } from '@/app/components/toast';
import { useRouter } from 'next/navigation';

interface ScoreColor {
  bg: string;
  text: string;
  gradient: string;
}

interface StatCard {
  label: string;
  value: number | string;
  icon: React.ComponentType<{ className: string }>;
  gradient: string;
  accent: string;
}

const UserDashboard: React.FC = () => {
  const [users, setUsers] = useState<Person[]>([]);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const service:CoreService = new CoreService();
  const {addToast, loading, setLoading} = useToast();
  const [username, setUsername] = useState<string>('')
  const [email, setEmail] = useState<string>('');
  const router = useRouter();
  
 const handleEditParams = async(id:number, type: 'email' | 'name') => {
  switch(type){
    case 'email':
      await handleEditParamRequest(id,'email',email);
      break;
    case 'name':
      await handleEditParamRequest(id,'name',username);
      break;
  }
  setIsEditing(false);
 }

 const handleEditParamRequest = async(id:number, key: 'email' | 'name', param:string) => {
  try{
      const res = await service.send('/users/api/update-parameter',{
        id,
        key,
        param
      })
      if(res.success){
        addToast(res.message,'success');
      }else{
        addToast(res.message,'error');
      }
  }catch(e:any){
    addToast(e.message,'error');
  }
 }

 const fetchUsers = async (): Promise<void> => {
  setLoading(true);
  try {
    const res = await service.get('/users/api/find-all-users');
    if (res.success && Array.isArray(res.data)) {
      const users = res.data.map((item: any) => Person.fromJson(item));
      setUsers(users);
      addToast(res.message, 'success');
      console.log(users)
    } else {
      addToast(res.message, 'warning');
    }
  } catch (e: any) {
    addToast(e.message, 'warning');
  }finally{
    setLoading(false);
  }
};

useEffect(() => {
  fetchUsers();
}, []);


  const copyToClipboard = (text: string, id: number): void => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const deleteUser = async (id: number): Promise<void> => {
    try{
      const res = await service.delete('/users/api/delete-user',{id});
      if(res.success){
        addToast(res.message,'success');
        setUsers(users.filter(user => user.id !== id));
      }else{
        addToast(res.message,'error');
      }
    }catch(e:any){
      addToast(e.message,'error');
    }    
  };

  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalUsers: number = users.length;
  const totalAttempts: number = users.reduce((sum, user) => sum + user.codeInfo.attempts, 0);
  const avgScore: string = users.length > 0 ? (users.reduce((sum, user) => sum + user.score, 0) / users.length).toFixed(1) : '0';
  const highestScore: number = Math.max(...users.map(u => u.score), 0);

  const getScoreColor = (score: number): ScoreColor => {
    if (score >= 85) return { bg: 'from-emerald-100 to-teal-100', text: 'text-emerald-700', gradient: 'from-emerald-500 to-teal-500' };
    if (score >= 70) return { bg: 'from-blue-100 to-cyan-100', text: 'text-blue-700', gradient: 'from-blue-500 to-cyan-500' };
    if (score >= 50) return { bg: 'from-yellow-100 to-orange-100', text: 'text-yellow-700', gradient: 'from-yellow-500 to-orange-500' };
    if (score > 0) return { bg: 'from-orange-100 to-red-100', text: 'text-orange-700', gradient: 'from-orange-500 to-red-500' };
    return { bg: 'from-gray-100 to-slate-100', text: 'text-gray-600', gradient: 'from-gray-400 to-slate-400' };
  };

  const getStatusIcon = (status: string): React.ReactNode => {
    return status === 'active' ? 
      <CheckCircle2 className="w-4 h-4" /> : 
      <AlertCircle className="w-4 h-4" />;
  };

  const stats: StatCard[] = [
    { label: 'Total Users', value: totalUsers, icon: Users, gradient: 'from-blue-500 to-cyan-500', accent: 'blue' },
    { label: 'Total Attempts', value: totalAttempts, icon: Zap, gradient: 'from-purple-500 to-pink-500', accent: 'purple' },
    { label: 'Average Score', value: avgScore, icon: Target, gradient: 'from-orange-500 to-red-500', accent: 'orange' },
    { label: 'Highest Score', value: highestScore, icon: TrendingUp, gradient: 'from-pink-500 to-rose-500', accent: 'pink' }
  ];

  return (
    <div className="min-h-screen bg-linear-to-br from-white via-blue-50 to-indigo-100 p-4 md:p-8">
      {/* Animated Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-64 md:w-96 h-64 md:h-96 bg-linear-to-br from-blue-200 to-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse"></div>
        <div className="absolute bottom-0 right-1/4 w-64 md:w-96 h-64 md:h-96 bg-linear-to-br from-pink-200 to-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse delay-7000"></div>
      </div>

      <div className="relative z-10">
        {/* Header Section */}
        <div className="mb-8 md:mb-12">
          <div className="flex items-start justify-between mb-6 md:mb-8 flex-wrap gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 md:gap-3 mb-2 md:mb-3 flex-wrap">
                <div className="p-2 md:p-3 bg-linear-to-br from-blue-500 to-purple-600 rounded-lg md:rounded-xl shadow-lg shrink-0">
                  <Users className="w-5 h-5 md:w-6 md:h-6 text-white" />
                </div>
                <h1 className="text-3xl md:text-5xl font-black bg-linear-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                  User Management
                </h1>
              </div>
              <p className="text-gray-600 text-xs md:text-base font-medium">Comprehensive analytics and user administration</p>
            </div>
            <button className="p-2 md:p-3 rounded-lg md:rounded-xl bg-white border border-gray-200 shadow-md hover:shadow-lg hover:border-gray-300 transition-all shrink-0">
              <LogOut className="w-4 h-4 md:w-5 md:h-5 text-gray-700"  onClick={() => router.back() }/>
            </button>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 md:left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 md:w-5 md:h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search users by name or email..."
              value={searchTerm}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
              className="w-full pl-10 md:pl-12 pr-4 md:pr-6 py-2 md:py-3 rounded-lg md:rounded-xl border border-gray-200 bg-white/80 backdrop-blur focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm transition-all text-sm md:text-base text-black placeholder:text-gray-500 md:placeholder:text-gray-700"
            />
          </div>
        </div>

        {/* Statistics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6 mb-8 md:mb-12">
          {stats.map((stat, i) => {
            const Icon = stat.icon;
            return (
              <div
                key={i}
                className="group relative bg-white border border-gray-100 rounded-xl md:rounded-2xl p-3 md:p-6 shadow-md hover:shadow-xl transition-all duration-300 hover:border-gray-200 overflow-hidden"
              >
                <div className={`absolute inset-0 bg-linear-to-br ${stat.gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-300`}></div>
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-2 md:mb-3">
                    <p className="text-gray-600 text-xs md:text-sm font-semibold">{stat.label}</p>
                    <div className={`p-1.5 md:p-2.5 bg-linear-to-br ${stat.gradient} rounded-lg shadow-lg group-hover:scale-110 transition-transform`}>
                      <Icon className="w-4 h-4 md:w-5 md:h-5 text-white" />
                    </div>
                  </div>
                  <p className="text-2xl md:text-4xl font-black text-gray-900">{stat.value}</p>
                  <div className={`h-1 w-8 md:w-12 bg-linear-to-r ${stat.gradient} rounded-full mt-2 md:mt-3 group-hover:w-full transition-all duration-300`}></div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Users Table */}
        {loading ? (<Loader className='w-4 h-4 animate-spin'></Loader>) : 
        (<div className="bg-white/80 backdrop-blur-xl rounded-xl md:rounded-2xl border border-gray-200/60 shadow-2xl overflow-hidden">
          {/* Table Header Background */}
          <div className="bg-linear-to-r from-blue-50 via-purple-50 to-pink-50 border-b border-gray-200/60 px-4 md:px-8 py-4 md:py-5">
            <div className="flex items-center justify-between">
              <h2 className="text-base md:text-lg font-bold text-gray-900">User Directory</h2>
              <span className="text-xs md:text-sm text-gray-500 font-medium">{filteredUsers.length} users</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-full">
              <thead>
                <tr className="border-b border-gray-100/50 bg-gray-50/50">
                  <th className="px-3 md:px-8 py-3 md:py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">ID</th>
                  <th className="px-3 md:px-8 py-3 md:py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Name</th>
                  <th className="px-3 md:px-8 py-3 md:py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Email</th>
                  <th className="px-3 md:px-8 py-3 md:py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Code</th>
                  <th className="px-3 md:px-8 py-3 md:py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Attempts</th>
                  <th className="px-3 md:px-8 py-3 md:py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Score</th>
                  <th className="px-3 md:px-8 py-3 md:py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user: Person) => {
                  const scoreColor: ScoreColor = getScoreColor(user.score);
                  return (
                    <tr
                      key={user.id}
                      className="border-b border-gray-100/30 hover:bg-linear-to-r hover:from-blue-50/40 hover:to-purple-50/40 transition-all duration-200 group"
                    >
                      <td className="px-3 md:px-8 py-3 md:py-5 text-xs md:text-sm">
                        <span className="px-2 md:px-3 py-1 bg-linear-to-r from-blue-100 to-blue-50 text-blue-700 rounded-lg font-bold text-xs">
                          #{user.id}
                        </span>
                      </td>
                      {!isEditing ? (
                      <><td className="px-3 md:px-8 py-3 md:py-5 text-xs md:text-sm font-bold text-gray-900">{user.name}</td><td className="px-3 md:px-8 py-3 md:py-5 text-xs md:text-sm text-gray-600 truncate">{user.email}</td></>
                       ) : (
                        <>
                        <td className="px-3 md:px-8 py-3 md:py-5 text-xs md:text-sm font-bold text-gray-900"><input value={user.name} onChange={(e) => {
                          const newName = e.target.value;

                          setUsers((prevUsers) =>
                            prevUsers.map((u) =>
                              u.id === user.id ? { ...u, name: newName } : u
                            )
                          );
                          setUsername(newName);
                        }} className="w-full md:w-auto bg-gray-50 border border-gray-200 rounded px-2 py-1 text-xs md:text-sm"></input>&nbsp;<Save onClick={() => handleEditParams(user.id,'name')} className="w-4 h-4 md:w-5 md:h-5 text-green-600 hover:text-black cursor-pointer inline"></Save></td>
                        <td className="px-3 md:px-8 py-3 md:py-5 text-xs md:text-sm text-gray-600"><input value={user.email} onChange={(e) =>
                          {
                          const newEmail = e.target.value;
                          setUsers((prev) => 
                            prev.map((u) => 
                              u.id == user.id ? {...u, email : newEmail} : u
                            )
                          )
                            setEmail(newEmail);
                        }} className="w-full md:w-auto bg-gray-50 border border-gray-200 rounded px-2 py-1 text-xs md:text-sm"></input>&nbsp;<Save onClick={() => handleEditParams(user.id, 'email')} className="w-4 h-4 md:w-5 md:h-5 text-green-600 hover:text-black cursor-pointer inline"></Save></td>
                        </>
                       )}
                      <td className="px-3 md:px-8 py-3 md:py-5 text-xs md:text-sm">
                        <div className="flex items-center gap-1 md:gap-2">
                          <code className="bg-linear-to-r from-purple-100 to-pink-100 text-purple-700 px-2 md:px-4 py-1 md:py-2 rounded-lg font-mono text-xs font-bold truncate">
                            {user.codeInfo.code}
                          </code>
                          <button
                            onClick={() => copyToClipboard(user.codeInfo.code, user.id)}
                            className="p-1 md:p-1.5 rounded-lg hover:bg-blue-100 transition-all opacity-0 group-hover:opacity-100 shrink-0"
                            title="Copy code"
                          >
                            {copiedId === user.id ? (
                              <CheckCircle2 className="w-4 h-4 text-green-600" />
                            ) : (
                              <Copy className="w-4 h-4 text-blue-600 hover:text-blue-700" />
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="px-3 md:px-8 py-3 md:py-5 text-xs md:text-sm">
                        <span className="px-2 md:px-3 py-1 md:py-1.5 bg-linear-to-r from-indigo-100 to-indigo-50 text-indigo-700 rounded-lg font-bold text-xs md:text-sm inline-block">
                          {user.codeInfo['attempts']}
                        </span>
                      </td>
                      <td className="px-3 md:px-8 py-3 md:py-5 text-xs md:text-sm">
                        <div className="flex items-center gap-1 md:gap-2">
                          <div className={`h-2 w-16 md:w-24 bg-gray-200 rounded-full overflow-hidden`}>
                            <div
                              className={`h-full bg-linear-to-r ${scoreColor.gradient} transition-all duration-300`}
                              style={{ width: `${Math.min(user.score, 100)}%` }}
                            ></div>
                          </div>
                          <span className={`px-2 md:px-3 py-1 rounded-lg font-bold text-xs md:text-sm inline-block bg-linear-to-r ${scoreColor.bg} ${scoreColor.text} whitespace-nowrap`}>
                            {user.score}
                          </span>
                        </div>
                      </td>
                      
                      <td className="px-3 md:px-8 py-3 md:py-5">
                        <div className="flex items-center gap-1 md:gap-2 opacity-0 group-hover:opacity-100 transition-all duration-200">
                          <button className="p-1.5 md:p-2.5 rounded-lg bg-linear-to-br from-blue-100 to-blue-50 hover:from-blue-200 hover:to-blue-100 text-blue-600 hover:text-blue-700 transition-all shadow-sm hover:shadow-md shrink-0" title="Edit">
                            <Edit2 className="w-4 h-4" onClick={() => {
                              setIsEditing(true)
                            }} />
                          </button>
                          <button
                            onClick={() => deleteUser(user.id)}
                            className="p-1.5 md:p-2.5 rounded-lg bg-linear-to-br from-red-100 to-red-50 hover:from-red-200 hover:to-red-100 text-red-600 hover:text-red-700 transition-all shadow-sm hover:shadow-md shrink-0"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {filteredUsers.length === 0 && (
            <div className="flex flex-col items-center justify-center h-40 md:h-64 text-gray-500 p-4">
              <Search className="w-8 h-8 md:w-12 md:h-12 mb-4 opacity-30" />
              <p className="text-base md:text-lg font-semibold text-center">No users found</p>
              <p className="text-xs md:text-sm text-center">Try adjusting your search filters</p>
            </div>
          )}
        </div>
        )}

        {/* Footer */}
        <div className="mt-6 md:mt-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 md:gap-0 px-2 md:px-4">
          <p className="text-xs md:text-sm text-gray-600 font-medium">
            Showing <span className="font-bold text-gray-900">{filteredUsers.length}</span> of <span className="font-bold text-gray-900">{users.length}</span> users
          </p>
          <div className="flex items-center gap-2 text-xs md:text-sm text-gray-600">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
            <span>Last updated: Just now</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserDashboard;