'use client';

import React, { useEffect, useState } from 'react';
import { 
  Trash2, Edit2, Copy, TrendingUp, Target, Users, Zap, Search, Filter, 
  CheckCircle2, AlertCircle, Save, Loader, SkipBack, LogOut, Download, 
  FileText, FileSpreadsheet, Printer, ChevronDown, Calendar, Award,
  Star, BarChart3, Activity, Clock, UserPlus, Eye, DownloadCloud,
  LayoutGrid, List, Grid, Maximize2, Minimize2, Medal, Crown
} from 'lucide-react';
import { Users as Person } from '@/app/helpers/factories';
import { CoreService } from '@/app/helpers/api-handler';
import { useToast } from '@/app/components/toast';
import { useRouter } from 'next/navigation';
import {
  Menu,
  MenuItem,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button as MuiButton,
  RadioGroup,
  FormControlLabel,
  Radio,
  Checkbox,
  FormGroup,
  Select,
  FormControl,
  InputLabel,
  Chip,
  Tooltip,
  Paper,
  TablePagination
} from '@mui/material';
import Validator from '@/app/components/validator';

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
  trend?: number;
}

interface UserPerformanceData {
  topPerformers: Person[];
  averageTimeSpent: number;
  completionRate: number;
  passingRate: number;
  distributionData: { range: string; count: number; color: string }[];
}

const UserDashboard: React.FC = () => {
  const [users, setUsers] = useState<Person[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<Person[]>([]);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [scoreFilter, setScoreFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('score');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [downloadDialogOpen, setDownloadDialogOpen] = useState<boolean>(false);
  const [downloadFormat, setDownloadFormat] = useState<'csv' | 'json' | 'pdf'>('csv');
  const [downloadScope, setDownloadScope] = useState<'all' | 'filtered' | 'selected'>('all');
  const [selectedUsers, setSelectedUsers] = useState<Set<number>>(new Set());
  const [includeStats, setIncludeStats] = useState<boolean>(true);
  const [includePerformance, setIncludePerformance] = useState<boolean>(true);
  const [includeTimestamps, setIncludeTimestamps] = useState<boolean>(true);
  const [performanceData, setPerformanceData] = useState<UserPerformanceData>({
    topPerformers: [],
    averageTimeSpent: 0,
    completionRate: 0,
    passingRate: 0,
    distributionData: []
  });
  const [page, setPage] = useState<number>(0);
  const [rowsPerPage, setRowsPerPage] = useState<number>(10);
  
  const service: CoreService = new CoreService();
  const { addToast, loading, setLoading } = useToast();
  const [username, setUsername] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const router = useRouter();
  const [editingUserId, setEditingUserId] = useState<number | null>(null);

  const handleEditParams = async (id: number, type: 'email' | 'name') => {
    switch (type) {
      case 'email':
        await handleEditParamRequest(id, 'email', email);
        break;
      case 'name':
        await handleEditParamRequest(id, 'name', username);
        break;
    }
    setIsEditing(false);
    setEditingUserId(null);
  };

  const handleEditParamRequest = async (id: number, key: 'email' | 'name', param: string) => {
    try {
      const res = await service.send('/users/api/update-parameter', {
        'userId': id,
        key,
        param
      });
      if (res.success) {
        addToast(res.message, 'success');
        await fetchUsers();
      } else {
        addToast(res.message, 'error');
      }
    } catch (e: any) {
      addToast(e.message, 'error');
    }
  };

  const fetchUsers = async (): Promise<void> => {
    setLoading(true);
    try {
      const res = await service.get('/users/api/find-all-users');
      if (res.success && Array.isArray(res.data)) {
        const usersData = res.data.map((item: any) => Person.fromJson(item));
        setUsers(usersData);
        calculatePerformanceMetrics(usersData);
        addToast(res.message, 'success');
      } else {
        addToast(res.message, 'warning');
      }
    } catch (e: any) {
      addToast(e.message, 'warning');
    } finally {
      setLoading(false);
    }
  };

  const calculatePerformanceMetrics = (usersData: Person[]) => {
    // Calculate top performers
    const topPerformers = [...usersData].sort((a, b) => b.score - a.score).slice(0, 5);
    
    // Calculate average time (mock data - replace with actual time data if available)
    const averageTimeSpent = Math.floor(Math.random() * 30) + 15; // 15-45 minutes
    
    // Calculate completion rate (users who have attempted quizzes)
    const usersWithAttempts = usersData.filter(u => u.codeInfo.attempts > 0);
    const completionRate = usersData.length > 0 ? (usersWithAttempts.length / usersData.length) * 100 : 0;
    
    // Calculate passing rate (score >= 60)
    const passingUsers = usersData.filter(u => u.score >= 60);
    const passingRate = usersData.length > 0 ? (passingUsers.length / usersData.length) * 100 : 0;
    
    // Score distribution
    const distributionData = [
      { range: '90-100%', count: usersData.filter(u => u.score >= 90).length, color: 'from-emerald-500 to-teal-500' },
      { range: '75-89%', count: usersData.filter(u => u.score >= 75 && u.score < 90).length, color: 'from-blue-500 to-cyan-500' },
      { range: '60-74%', count: usersData.filter(u => u.score >= 60 && u.score < 75).length, color: 'from-yellow-500 to-orange-500' },
      { range: '40-59%', count: usersData.filter(u => u.score >= 40 && u.score < 60).length, color: 'from-orange-500 to-red-500' },
      { range: '0-39%', count: usersData.filter(u => u.score < 40 && u.score > 0).length, color: 'from-red-500 to-rose-500' },
      { range: 'No Score', count: usersData.filter(u => u.score === 0).length, color: 'from-gray-500 to-slate-500' }
    ];
    
    setPerformanceData({
      topPerformers,
      averageTimeSpent,
      completionRate,
      passingRate,
      distributionData
    });
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    let filtered = [...users];
    
    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(user =>
        user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    // Apply score filter
    if (scoreFilter !== 'all') {
      const [min, max] = scoreFilter.split('-').map(Number);
      filtered = filtered.filter(user => {
        if (scoreFilter === '0') return user.score === 0;
        return user.score >= min && user.score <= max;
      });
    }
    
    // Apply sorting
    filtered.sort((a, b) => {
      let aVal: any = a[sortBy as keyof Person];
      let bVal: any = b[sortBy as keyof Person];
      if (sortBy === 'score') {
        return sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
      }
      if (sortBy === 'name') {
        return sortOrder === 'desc' ? bVal.localeCompare(aVal) : aVal.localeCompare(bVal);
      }
      return sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
    });
    
    setFilteredUsers(filtered);
  }, [users, searchTerm, scoreFilter, sortBy, sortOrder]);

  const copyToClipboard = (text: string, id: number): void => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    addToast('Code copied to clipboard!', 'success');
  };

  const deleteUser = async (id: number): Promise<void> => {
    if (window.confirm('Are you sure you want to delete this user?')) {
      try {
        const res = await service.delete('/users/api/delete-user', { 'userId': id });
        if (res.success) {
          addToast(res.message, 'success');
          await fetchUsers();
        } else {
          addToast(res.message, 'error');
        }
      } catch (e: any) {
        addToast(e.message, 'error');
      }
    }
  };

  const downloadResults = () => {
  let dataToDownload: any[] = [];

  if (downloadScope === 'all') {
    dataToDownload = users;
  } else if (downloadScope === 'filtered') {
    dataToDownload = filteredUsers;
  } else {
    dataToDownload = users.filter(u => selectedUsers.has(u.id));
  }

  // --- Grading system: 70+ = A, standard scale below that ---
  function getGrade(score: number): { letter: string; label: string; color: string } {
    if (score >= 70) return { letter: 'A', label: 'Excellent', color: '#059669' };
    if (score >= 60) return { letter: 'B', label: 'Good', color: '#2563eb' };
    if (score >= 50) return { letter: 'C', label: 'Average', color: '#d97706' };
    if (score >= 40) return { letter: 'D', label: 'Below Average', color: '#ea580c' };
    if (score > 0) return { letter: 'F', label: 'Fail', color: '#dc2626' };
    return { letter: '—', label: 'No Attempt', color: '#94a3b8' };
  }

  function calculateMedian(arr: number[]): number {
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  // Calculate comprehensive statistics
  const stats = {
    totalUsers: dataToDownload.length,
    averageScore: dataToDownload.reduce((sum, u) => sum + u.score, 0) / dataToDownload.length,
    medianScore: calculateMedian(dataToDownload.map(u => u.score)),
    passingRate: (dataToDownload.filter(u => u.score >= 60).length / dataToDownload.length) * 100,
    failingRate: (dataToDownload.filter(u => u.score < 60 && u.score > 0).length / dataToDownload.length) * 100,
    noScoreRate: (dataToDownload.filter(u => u.score === 0).length / dataToDownload.length) * 100,
    totalAttempts: dataToDownload.reduce((sum, u) => sum + u.attempts, 0),
    averageAttempts: dataToDownload.reduce((sum, u) => sum + u.attempts, 0) / dataToDownload.length,
    highestScore: Math.max(...dataToDownload.map(u => u.score)),
    lowestScore: Math.min(...dataToDownload.map(u => u.score)),
    gradeDistribution: {
      A: dataToDownload.filter(u => u.score >= 70).length,
      B: dataToDownload.filter(u => u.score >= 60 && u.score < 70).length,
      C: dataToDownload.filter(u => u.score >= 50 && u.score < 60).length,
      D: dataToDownload.filter(u => u.score >= 40 && u.score < 50).length,
      F: dataToDownload.filter(u => u.score < 40 && u.score > 0).length,
      NA: dataToDownload.filter(u => u.score === 0).length
    }
  };

  const avgGrade = getGrade(stats.averageScore);

  // --- Generate narrative performance insights from the data ---
  function generateInsights(): { title: string; text: string }[] {
    const insights: { title: string; text: string }[] = [];
    const passed = dataToDownload.filter(u => u.score >= 60);
    const notPassed = dataToDownload.filter(u => u.score < 60 && u.score > 0);

    // 1. Overall performance vs benchmark
    const benchmarkGap = stats.averageScore - 60;
    insights.push({
      title: 'Overall Performance',
      text: `The cohort averaged ${stats.averageScore.toFixed(1)}% (Grade ${avgGrade.letter} — ${avgGrade.label.toLowerCase()}), which is ${benchmarkGap >= 0 ? `${benchmarkGap.toFixed(1)} points above` : `${Math.abs(benchmarkGap).toFixed(1)} points below`} the 60% passing benchmark. The median score of ${stats.medianScore.toFixed(1)}% is ${Math.abs(stats.medianScore - stats.averageScore) < 2 ? 'closely aligned with the average, suggesting a fairly even spread of results' : stats.medianScore > stats.averageScore ? 'higher than the average, indicating a small number of low scores are pulling the mean down' : 'lower than the average, indicating a small number of high scores are pulling the mean up'}.`
    });

    // 2. Grade distribution shape
    const aPct = (stats.gradeDistribution.A / stats.totalUsers) * 100;
    const strugglingPct = ((stats.gradeDistribution.D + stats.gradeDistribution.F + stats.gradeDistribution.NA) / stats.totalUsers) * 100;
    insights.push({
      title: 'Grade Distribution',
      text: `${aPct.toFixed(0)}% of students earned an A grade (70%+), while ${strugglingPct.toFixed(0)}% fall into the D, F, or no-attempt range. ${strugglingPct > aPct ? 'This skew toward the lower bands suggests the material or assessment may need review, or that a targeted intervention group should be identified.' : aPct > 50 ? 'The distribution is skewed toward strong performance, indicating the cohort has a solid grasp of the material overall.' : 'Results are fairly evenly spread across grade bands, which is typical for a mixed-ability group.'}`
    });

    // 3. Attempts vs outcome
    const avgAttemptsPassed = passed.length ? passed.reduce((s, u) => s + u.attempts, 0) / passed.length : 0;
    const avgAttemptsNotPassed = notPassed.length ? notPassed.reduce((s, u) => s + u.attempts, 0) / notPassed.length : 0;
    insights.push({
      title: 'Attempt Patterns',
      text: notPassed.length && passed.length
        ? `Students who passed averaged ${avgAttemptsPassed.toFixed(1)} attempts, compared to ${avgAttemptsNotPassed.toFixed(1)} attempts among those who did not. ${avgAttemptsPassed > avgAttemptsNotPassed ? 'This suggests repeated attempts are associated with better outcomes — students who kept retrying tended to improve.' : 'This suggests more attempts alone did not translate into passing scores, so struggling students may need a different kind of support rather than just more retries.'}`
        : `The cohort logged ${1} attempts in total, averaging ${1} per student.`
    });

    // 4. Engagement / no-attempt callout
    if (stats.gradeDistribution.NA > 0) {
      insights.push({
        title: 'Engagement Gap',
        text: `${stats.gradeDistribution.NA} student${stats.gradeDistribution.NA === 1 ? ' has' : 's have'} not attempted the assessment at all (${stats.noScoreRate.toFixed(1)}% of this group). Following up with this group directly is likely to have a bigger impact on the overall pass rate than adjusting difficulty for those who have already engaged.`
      });
    }

    // 5. Spread / outliers
    const spread = stats.highestScore - stats.lowestScore;
    insights.push({
      title: 'Performance Spread',
      text: `Scores range from ${stats.lowestScore}% to ${stats.highestScore}%, a spread of ${spread} points. ${spread > 60 ? 'This wide range points to significant variation in readiness within the group, and may warrant differentiated support rather than a one-size-fits-all approach.' : 'This relatively tight range suggests the group is fairly uniform in readiness.'}`
    });

    return insights;
  }

  const insights = generateInsights();

  if (downloadFormat === 'csv') {
    const headers = ['ID', 'Name', 'Email', 'Access Code', 'Attempts', 'Score (%)', 'Grade', 'Status'];
    const csvRows: string[] = [headers.join(',')];

    dataToDownload.forEach(user => {
      const grade = getGrade(user.score);
      const row = [
        user.id,
        `"${user.name}"`,
        `"${user.email}"`,
        `"${user.codeInfo.code}"`,
        user.attempts,
        user.score.toFixed(1),
        `"${grade.letter} - ${grade.label}"`,
        `"${user.score >= 60 ? 'PASS' : user.score > 0 ? 'FAIL' : 'NO ATTEMPT'}"`
      ];
      csvRows.push(row.join(','));
    });

    csvRows.push('');
    csvRows.push('"SUMMARY STATISTICS"');
    csvRows.push(`"Total Users",${stats.totalUsers}`);
    csvRows.push(`"Average Score",${stats.averageScore.toFixed(1)}%`);
    csvRows.push(`"Average Grade",${avgGrade.letter}`);
    csvRows.push(`"Median Score",${stats.medianScore.toFixed(1)}%`);
    csvRows.push(`"Passing Rate",${stats.passingRate.toFixed(1)}%`);
    csvRows.push(`"Highest Score",${stats.highestScore}%`);
    csvRows.push(`"Lowest Score",${stats.lowestScore}%`);
    csvRows.push(`"Total Attempts",${stats.totalAttempts}`);
    csvRows.push('');
    csvRows.push('"INSIGHTS"');
    insights.forEach(i => csvRows.push(`"${i.title}","${i.text.replace(/"/g, "'")}"`));

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `user_performance_report_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    addToast('CSV file downloaded successfully!', 'success');

  } else if (downloadFormat === 'json') {
    const jsonData = {
      reportGenerated: new Date().toISOString(),
      summary: {
        totalUsers: stats.totalUsers,
        averageScore: stats.averageScore,
        averageGrade: avgGrade.letter,
        medianScore: stats.medianScore,
        passingRate: stats.passingRate,
        failingRate: stats.failingRate,
        noScoreRate: stats.noScoreRate,
        totalAttempts: stats.totalAttempts,
        averageAttempts: stats.averageAttempts,
        highestScore: stats.highestScore,
        lowestScore: stats.lowestScore,
        gradeDistribution: stats.gradeDistribution
      },
      insights,
      users: dataToDownload.map(user => {
        const grade = getGrade(user.score);
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          accessCode: user.codeInfo.code,
          attempts: user.attempts,
          score: user.score,
          grade: grade.letter,
          gradeLabel: grade.label,
          status: user.score >= 60 ? 'PASS' : user.score > 0 ? 'FAIL' : 'NO ATTEMPT'
        };
      })
    };

    const blob = new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `user_performance_report_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    addToast('JSON file downloaded successfully!', 'success');

  } else {
    // PDF Export - Modern Professional Report
    const printWindow = window.open('', '_blank', 'width=1200,height=800');
    if (printWindow) {
      const sortedUsers = [...dataToDownload].sort((a, b) => b.score - a.score);
      const needsAttentionUsers = sortedUsers.filter((user) => user.score < 60);

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Student Performance Report</title>
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
          <style>
            @page {
              size: A4;
              margin: 30px 40px;
            }
            * { box-sizing: border-box; }
            html, body {
              width: 100%;
              max-width: 100%;
              overflow-x: hidden;
            }
            body {
              font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
              margin: 0;
              padding: 0;
              background: #ffffff;
              color: #0f172a;
              line-height: 1.5;
              -webkit-font-smoothing: antialiased;
            }
            .report-container {
              width: 100%;
              max-width: 100%;
              margin: 0 auto;
            }

            /* Header */
            .header {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              padding-bottom: 18px;
              margin-bottom: 22px;
              border-bottom: 2px solid #0f172a;
              page-break-after: avoid;
            }
            .header-left .eyebrow {
              font-size: 11px;
              font-weight: 700;
              letter-spacing: 1.5px;
              text-transform: uppercase;
              color: #64748b;
              margin-bottom: 6px;
            }
            .header-left h1 {
              font-size: 25px;
              font-weight: 800;
              margin: 0 0 6px 0;
              letter-spacing: -0.5px;
              color: #0f172a;
            }
            .header-left .subtitle {
              font-size: 13px;
              color: #64748b;
            }
            .header-right {
              text-align: right;
              font-size: 12px;
              color: #64748b;
              flex-shrink: 0;
            }
            .header-right .date {
              font-weight: 600;
              color: #0f172a;
              margin-bottom: 4px;
            }

            /* Stats Grid */
            .stats-grid {
              display: grid;
              grid-template-columns: repeat(5, minmax(0, 1fr));
              gap: 10px;
              margin-bottom: 22px;
              page-break-inside: avoid;
              break-inside: avoid;
            }
            .stat-card {
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 10px;
              padding: 14px 14px;
              min-width: 0;
              overflow: hidden;
            }
            .stat-label {
              font-size: 10.5px;
              text-transform: uppercase;
              color: #64748b;
              font-weight: 700;
              letter-spacing: 0.4px;
              margin-bottom: 6px;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
            .stat-value {
              font-size: 21px;
              font-weight: 800;
              color: #0f172a;
              letter-spacing: -0.5px;
              white-space: nowrap;
            }
            .stat-sub {
              font-size: 10.5px;
              color: #94a3b8;
              margin-top: 3px;
              font-weight: 500;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
            .grade-pill {
              display: inline-flex;
              align-items: center;
              justify-content: center;
              width: 20px;
              height: 20px;
              border-radius: 6px;
              font-size: 11px;
              font-weight: 800;
              color: white;
              margin-left: 5px;
              vertical-align: middle;
            }

            /* Two-column section */
            .performance-section {
              display: grid;
              grid-template-columns: 1.2fr 1fr;
              gap: 14px;
              margin-bottom: 22px;
              page-break-inside: avoid;
              break-inside: avoid;
            }
            .panel {
              background: #ffffff;
              border: 1px solid #e2e8f0;
              border-radius: 10px;
              padding: 18px;
              min-width: 0;
              overflow: hidden;
            }
            .panel h3 {
              font-size: 12.5px;
              margin: 0 0 14px 0;
              color: #0f172a;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 0.4px;
            }

            /* Distribution Bars */
            .dist-bar {
              display: flex;
              align-items: center;
              gap: 8px;
              margin-bottom: 8px;
            }
            .dist-label {
              width: 92px;
              flex-shrink: 0;
              font-size: 11.5px;
              color: #334155;
              font-weight: 600;
              display: flex;
              align-items: center;
              gap: 6px;
            }
            .dist-track {
              flex: 1;
              min-width: 0;
              height: 16px;
              background: #f1f5f9;
              border-radius: 4px;
              overflow: hidden;
            }
            .dist-fill {
              height: 100%;
              border-radius: 4px;
              display: flex;
              align-items: center;
              justify-content: flex-end;
              padding-right: 8px;
              font-size: 10px;
              font-weight: 700;
              color: white;
            }

            /* Performer lists */
            .performer-row {
              display: flex;
              align-items: center;
              gap: 10px;
              padding: 7px 9px;
              border-radius: 8px;
              margin-bottom: 5px;
              page-break-inside: avoid;
              break-inside: avoid;
            }
            .performer-row:nth-child(odd) { background: #f8fafc; }
            .performer-rank {
              width: 20px;
              height: 20px;
              border-radius: 6px;
              background: #0f172a;
              color: white;
              display: flex;
              align-items: center;
              justify-content: center;
              font-weight: 700;
              font-size: 10.5px;
              flex-shrink: 0;
            }
            .performer-info { flex: 1; min-width: 0; }
            .performer-name {
              font-weight: 600;
              font-size: 12px;
              color: #0f172a;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
            .performer-email {
              font-size: 10px;
              color: #94a3b8;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
            .performer-score {
              font-weight: 700;
              font-size: 12.5px;
              flex-shrink: 0;
            }
            .section-divider {
              font-size: 10px;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 0.4px;
              color: #94a3b8;
              margin: 12px 0 7px 0;
            }
            .section-divider:first-child { margin-top: 0; }

            /* Insights */
            .insights-panel {
              background: #ffffff;
              border: 1px solid #e2e8f0;
              border-radius: 10px;
              padding: 20px;
              margin-bottom: 22px;
            }
            .insights-panel h3 {
              font-size: 12.5px;
              margin: 0 0 16px 0;
              color: #0f172a;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 0.4px;
            }
            .insight-item {
              display: flex;
              gap: 12px;
              padding: 12px 0;
              border-bottom: 1px solid #f1f5f9;
              page-break-inside: avoid;
              break-inside: avoid;
            }
            .insight-item:last-child { border-bottom: none; padding-bottom: 0; }
            .insight-item:first-child { padding-top: 0; }
            .insight-marker {
              width: 26px;
              height: 26px;
              border-radius: 7px;
              background: #eef2ff;
              color: #4338ca;
              flex-shrink: 0;
              display: flex;
              align-items: center;
              justify-content: center;
              font-weight: 800;
              font-size: 11px;
            }
            .insight-body { min-width: 0; }
            .insight-title {
              font-size: 12.5px;
              font-weight: 700;
              color: #0f172a;
              margin-bottom: 3px;
            }
            .insight-text {
              font-size: 12px;
              color: #475569;
              line-height: 1.6;
            }

            /* Table */
            .table-container {
              background: #ffffff;
              border: 1px solid #e2e8f0;
              border-radius: 10px;
              padding: 18px;
              margin-bottom: 22px;
              width: 100%;
              max-width: 100%;
              overflow: visible;
            }
            .table-container h3 {
              font-size: 12.5px;
              margin: 0 0 14px 0;
              color: #0f172a;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 0.4px;
            }
            table {
              width: 100%;
              max-width: 100%;
              table-layout: fixed;
              border-collapse: collapse;
              font-size: 11.5px;
            }
            th:nth-child(1) { width: 5%; }
            th:nth-child(2) { width: 18%; }
            th:nth-child(3) { width: 22%; }
            th:nth-child(4) { width: 13%; }
            th:nth-child(5) { width: 9%; }
            th:nth-child(6) { width: 9%; }
            th:nth-child(7) { width: 15%; }
            th:nth-child(8) { width: 9%; }
            thead {
              background: #0f172a;
              color: white;
              display: table-header-group;
            }
            th {
              padding: 9px 10px;
              text-align: left;
              font-weight: 600;
              font-size: 10.5px;
              text-transform: uppercase;
              letter-spacing: 0.3px;
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
            }
            td {
              padding: 8px 10px;
              border-bottom: 1px solid #f1f5f9;
              color: #334155;
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
            }
            tbody tr {
              page-break-inside: avoid;
              break-inside: avoid;
            }
            tbody tr:hover { background: #f8fafc; }
            .grade-badge {
              display: inline-flex;
              align-items: center;
              gap: 5px;
              padding: 2px 8px;
              border-radius: 6px;
              font-weight: 700;
              font-size: 10.5px;
              white-space: nowrap;
            }
            .status-badge {
              display: inline-block;
              padding: 2px 8px;
              border-radius: 6px;
              font-weight: 600;
              font-size: 10px;
              text-transform: uppercase;
              letter-spacing: 0.3px;
              white-space: nowrap;
            }
            .status-pass { background: #dcfce7; color: #166534; }
            .status-fail { background: #fee2e2; color: #991b1b; }
            .status-no-attempt { background: #f1f5f9; color: #64748b; }

            /* Footer */
            .footer {
              margin-top: 20px;
              padding-top: 14px;
              border-top: 1px solid #e2e8f0;
              display: flex;
              justify-content: space-between;
              align-items: center;
              font-size: 10.5px;
              color: #94a3b8;
              page-break-inside: avoid;
            }
            .footer .brand { font-weight: 700; color: #334155; }

            @media print {
              html, body { width: 100%; overflow: visible !important; }
              .report-container { max-width: 100%; }
              .table-container { overflow: visible !important; }
              .stats-grid, .performance-section, .performer-row, .insight-item, tr, .footer {
                page-break-inside: avoid;
                break-inside: avoid;
              }
              thead { display: table-header-group; }
              .header, .stats-grid { page-break-after: avoid; }
              .header {
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              .grade-badge, .status-badge, .dist-fill, .performer-rank, .grade-pill, .insight-marker {
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              thead {
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
            }
          </style>
        </head>
        <body>
          <div class="report-container">

            <!-- Header -->
            <div class="header">
              <div class="header-left">
                <div class="eyebrow">Academic Performance Report</div>
                <h1>Student Performance Summary</h1>
                <div class="subtitle">Comprehensive analysis and progress tracking · ${stats.totalUsers} students</div>
              </div>
              <div class="header-right">
                <div class="date">${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
                <div>Generated ${new Date().toLocaleTimeString()}</div>
              </div>
            </div>

            <!-- Stats Grid -->
            <div class="stats-grid">
              <div class="stat-card">
                <div class="stat-label">Average Score</div>
                <div class="stat-value">${stats.averageScore.toFixed(1)}%<span class="grade-pill" style="background:${avgGrade.color}">${avgGrade.letter}</span></div>
                <div class="stat-sub">${avgGrade.label}</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">Passing Rate</div>
                <div class="stat-value">${stats.passingRate.toFixed(1)}%</div>
                <div class="stat-sub">${stats.passingRate >= 70 ? 'Strong cohort' : stats.passingRate >= 50 ? 'Acceptable' : 'Needs attention'}</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">Median Score</div>
                <div class="stat-value">${stats.medianScore.toFixed(1)}%</div>
                <div class="stat-sub">Midpoint performance</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">Highest Score</div>
                <div class="stat-value">${stats.highestScore}%</div>
                <div class="stat-sub">Top performer</div>
              </div>
              
            </div>

            <!-- Performance Section -->
            <div class="performance-section">
              <div class="panel">
                <h3>Grade Distribution</h3>
                ${Object.entries({
                  A: { count: stats.gradeDistribution.A, color: '#059669', range: '70-100%' },
                  B: { count: stats.gradeDistribution.B, color: '#2563eb', range: '60-69%' },
                  C: { count: stats.gradeDistribution.C, color: '#d97706', range: '50-59%' },
                  D: { count: stats.gradeDistribution.D, color: '#ea580c', range: '40-49%' },
                  F: { count: stats.gradeDistribution.F, color: '#dc2626', range: '1-39%' },
                  '—': { count: stats.gradeDistribution.NA, color: '#94a3b8', range: 'No attempt' }
                }).map(([letter, data]) => `
                  <div class="dist-bar">
                    <div class="dist-label"><span class="grade-pill" style="background:${data.color}; width:16px; height:16px; font-size:10px;">${letter}</span> ${data.range}</div>
                    <div class="dist-track">
                      <div class="dist-fill" style="width: ${stats.totalUsers ? (data.count / stats.totalUsers * 100) : 0}%; background: ${data.color}">
                        ${data.count > 0 ? data.count : ''}
                      </div>
                    </div>
                  </div>
                `).join('')}
              </div>

              <div class="panel">
                <h3>Top &amp; Bottom Performers</h3>
                <div class="section-divider">Top 3</div>
                ${sortedUsers.slice(0, 3).map((user, index) => `
                  <div class="performer-row">
                    <div class="performer-rank">${index + 1}</div>
                    <div class="performer-info">
                      <div class="performer-name">${user.name}</div>
                      <div class="performer-email">${user.email}</div>
                    </div>
                    <div class="performer-score" style="color:#059669;">${user.score}%</div>
                  </div>
                `).join('')}
                ${needsAttentionUsers.length > 0 ? `<div class="section-divider">Needs Attention</div>
                ${needsAttentionUsers.slice(-3).reverse().map((user) => `
                  <div class="performer-row">
                    <div class="performer-rank" style="background:#dc2626;">${sortedUsers.indexOf(user) + 1}</div>
                    <div class="performer-info">
                      <div class="performer-name">${user.name}</div>
                      <div class="performer-email">${user.email}</div>
                    </div>
                    <div class="performer-score" style="color:#dc2626;">${user.score}%</div>
                  </div>
                `).join('')}` : ''}
              </div>
            </div>

            <!-- Insights -->
            <div class="insights-panel">
              <h3>Performance Insights &amp; Recommendations</h3>
              ${insights.map((insight, i) => `
                <div class="insight-item">
                  <div class="insight-marker">${i + 1}</div>
                  <div class="insight-body">
                    <div class="insight-title">${insight.title}</div>
                    <div class="insight-text">${insight.text}</div>
                  </div>
                </div>
              `).join('')}
            </div>

            <!-- Detailed Table -->
            <div class="table-container">
              <h3>Detailed Student Records</h3>
              <table>
                <colgroup>
                  <col /><col /><col /><col /><col /><col /><col /><col />
                </colgroup>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Name</th>
                    <th>Email</th>
                    
                    
                    <th>Score</th>
                    <th>Grade</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${sortedUsers.map((user, index) => {
                    const grade = getGrade(user.score);
                    return `
                    <tr>
                      <td>${index + 1}</td>
                      <td><strong>${user.name}</strong></td>
                      <td style="color:#94a3b8; font-size:10.5px;">${user.email}</td>
                      
                      
                      <td style="font-weight:700;">${user.score}%</td>
                      <td><span class="grade-badge" style="background:${grade.color}20; color:${grade.color};">${grade.letter} · ${grade.label}</span></td>
                      <td><span class="status-badge ${user.score >= 60 ? 'status-pass' : user.score > 0 ? 'status-fail' : 'status-no-attempt'}">${user.score >= 60 ? 'Pass' : user.score > 0 ? 'Fail' : 'No attempt'}</span></td>
                    </tr>
                  `;
                  }).join('')}
                </tbody>
              </table>
            </div>

            <!-- Footer -->
            <div class="footer">
              <div class="brand">Lan's Hub Academic Report</div>
              <div>Confidential — for internal use only</div>
            </div>

          </div>

          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
        </html>
      `);
      printWindow.document.close();
      addToast('Professional PDF report generated successfully!', 'success');
    }
  }

  setDownloadDialogOpen(false);
};

  const getScoreColor = (score: number): ScoreColor => {
    if (score >= 85) return { bg: 'from-emerald-100 to-teal-100', text: 'text-emerald-700', gradient: 'from-emerald-500 to-teal-500' };
    if (score >= 70) return { bg: 'from-blue-100 to-cyan-100', text: 'text-blue-700', gradient: 'from-blue-500 to-cyan-500' };
    if (score >= 50) return { bg: 'from-yellow-100 to-orange-100', text: 'text-yellow-700', gradient: 'from-yellow-500 to-orange-500' };
    if (score > 0) return { bg: 'from-orange-100 to-red-100', text: 'text-orange-700', gradient: 'from-orange-500 to-red-500' };
    return { bg: 'from-gray-100 to-slate-100', text: 'text-gray-600', gradient: 'from-gray-400 to-slate-400' };
  };

  const totalUsers: number = users.length;
  const totalAttempts: number = users.reduce((sum, user) => sum + user.codeInfo.attempts, 0);
  const avgScore: string = users.length > 0 ? (users.reduce((sum, user) => sum + user.score, 0) / users.length).toFixed(1) : '0';
  const highestScore: number = Math.max(...users.map(u => u.score), 0);

  const stats: StatCard[] = [
    { label: 'Total Users', value: totalUsers, icon: Users, gradient: 'from-blue-500 to-cyan-500', accent: 'blue', trend: +12 },
    { label: 'Total Attempts', value: totalAttempts, icon: Zap, gradient: 'from-purple-500 to-pink-500', accent: 'purple', trend: +8 },
    { label: 'Average Score', value: avgScore + '%', icon: Target, gradient: 'from-orange-500 to-red-500', accent: 'orange', trend: +5 },
    { label: 'Highest Score', value: highestScore + '%', icon: TrendingUp, gradient: 'from-pink-500 to-rose-500', accent: 'pink', trend: +3 }
  ];

  const handleSelectAll = () => {
    if (selectedUsers.size === filteredUsers.length) {
      setSelectedUsers(new Set());
    } else {
      setSelectedUsers(new Set(filteredUsers.map(u => u.id)));
    }
  };

  const handleSelectUser = (id: number) => {
    const newSelected = new Set(selectedUsers);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedUsers(newSelected);
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 via-white to-blue-50">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-xl border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-linear-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                <Users className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold bg-linear-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  User Management
                </h1>
                <p className="text-xs text-gray-500">Manage and track user performance</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Tooltip title="Download Results">
                <button
                  onClick={() => setDownloadDialogOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-linear-to-r from-emerald-600 to-teal-600 text-white rounded-xl hover:shadow-lg transition-all"
                >
                  <DownloadCloud className="w-4 h-4" />
                  <span className="hidden sm:inline">Export</span>
                </button>
              </Tooltip>
              <Tooltip title="Back">
                <button
                  onClick={() => router.back()}
                  className="p-2 bg-gray-100 rounded-xl hover:bg-gray-200 transition"
                >
                  <LogOut className="w-5 h-5 text-gray-700" />
                </button>
              </Tooltip>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {stats.map((stat, i) => {
            const Icon = stat.icon;
            return (
              <div
                key={i}
                className="group relative bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-xl transition-all duration-300"
              >
                <div className="absolute inset-0 bg-linear-to-br opacity-0 group-hover:opacity-5 rounded-2xl transition-opacity"></div>
                <div className="relative">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-gray-600 text-sm font-semibold">{stat.label}</p>
                    <div className={`p-2 bg-linear-to-br ${stat.gradient} rounded-lg shadow-md`}>
                      <Icon className="w-4 h-4 text-white" />
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                  {stat.trend && (
                    <div className="flex items-center gap-1 mt-2">
                      <TrendingUp className="w-3 h-3 text-green-600" />
                      <span className="text-xs text-green-600">+{stat.trend}%</span>
                      <span className="text-xs text-gray-400 ml-1">vs last month</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Performance Metrics */}
        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          {/* Top Performers */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Crown className="w-5 h-5 text-yellow-500" />
                <h3 className="text-lg font-semibold text-gray-900">Top Performers</h3>
              </div>
              <Chip label="This Month" size="small" className="bg-blue-100 text-blue-700" />
            </div>
            <div className="space-y-3">
              {performanceData.topPerformers.map((user, index) => (
                <div key={user.id} className="flex items-center justify-between p-3 bg-linear-to-r from-gray-50 to-white rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-linear-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-white font-bold text-sm">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{user.name}</p>
                      <p className="text-xs text-gray-500">{user.email}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-gray-900">{user.score}%</p>
                    <div className="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full bg-linear-to-r from-emerald-500 to-teal-500 rounded-full" style={{ width: `${user.score}%` }}></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Score Distribution */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-purple-500" />
                <h3 className="text-lg font-semibold text-gray-900">Score Distribution</h3>
              </div>
              <Chip label="Overall" size="small" className="bg-purple-100 text-purple-700" />
            </div>
            <div className="space-y-3">
              {performanceData.distributionData.map((dist, index) => (
                <div key={index}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">{dist.range}</span>
                    <span className="font-semibold text-gray-900">{dist.count} users</span>
                  </div>
                  <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className={`h-full bg-linear-to-r ${dist.color} rounded-full transition-all duration-500`} 
                      style={{ width: `${(dist.count / users.length) * 100}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Filters and Actions */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Search */}
            <div className="flex-1 min-w-50">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search users..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition text-sm"
                />
              </div>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-3">
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel>Score Range</InputLabel>
                <Select
                  value={scoreFilter}
                  onChange={(e) => setScoreFilter(e.target.value)}
                  label="Score Range"
                >
                  <MenuItem value="all">All Scores</MenuItem>
                  <MenuItem value="90-100">90-100%</MenuItem>
                  <MenuItem value="75-89">75-89%</MenuItem>
                  <MenuItem value="60-74">60-74%</MenuItem>
                  <MenuItem value="40-59">40-59%</MenuItem>
                  <MenuItem value="0">No Score</MenuItem>
                </Select>
              </FormControl>

              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel>Sort By</InputLabel>
                <Select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  label="Sort By"
                >
                  <MenuItem value="score">Score</MenuItem>
                  <MenuItem value="name">Name</MenuItem>
                  <MenuItem value="id">ID</MenuItem>
                </Select>
              </FormControl>

              <button
                onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
                className="p-2 border border-gray-200 rounded-xl hover:bg-gray-50 transition"
              >
                {sortOrder === 'desc' ? '↓' : '↑'}
              </button>

              <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-xl">
                <button
                  onClick={() => setViewMode('table')}
                  className={`p-1.5 rounded-lg transition ${viewMode === 'table' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500'}`}
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 rounded-lg transition ${viewMode === 'grid' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500'}`}
                >
                  <Grid className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Bulk Actions */}
          {selectedUsers.size > 0 && (
            <div className="mt-4 p-3 bg-blue-50 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-blue-600" />
                <span className="text-sm text-gray-700">{selectedUsers.size} users selected</span>
              </div>
              <button
                onClick={() => setSelectedUsers(new Set())}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                Clear Selection
              </button>
            </div>
          )}
        </div>

        {/* Users Table/Grid */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : viewMode === 'table' ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-linear-to-r from-gray-50 to-white border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 w-10">
                      <Checkbox
                        checked={selectedUsers.size === filteredUsers.length && filteredUsers.length > 0}
                        onChange={handleSelectAll}
                        size="small"
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">ID</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">User</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Access Code</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Attempts</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Score</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredUsers.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((user) => {
                    const scoreColor = getScoreColor(user.score);
                    return (
                      <tr key={user.id} className="hover:bg-gray-50 transition group">
                        <td className="px-4 py-3">
                          <Checkbox
                            checked={selectedUsers.has(user.id)}
                            onChange={() => handleSelectUser(user.id)}
                            size="small"
                          />
                        </td>
                        <td className="px-4 py-3 text-sm font-mono text-gray-600">#{user.id}</td>
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-semibold text-gray-900">{user.name}</p>
                            <p className="text-xs text-gray-500">{user.email}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <code className="text-sm font-mono bg-gray-100 px-2 py-1 rounded text-gray-700">
                              {user.codeInfo.code}
                            </code>
                            <button
                              onClick={() => copyToClipboard(user.codeInfo.code, user.id)}
                              className="opacity-0 group-hover:opacity-100 transition"
                            >
                              <Copy className="w-3 h-3 text-gray-400 hover:text-blue-600" />
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center px-2 py-1 rounded-lg bg-purple-100 text-purple-700 text-xs font-semibold">
                            {user.codeInfo.attempts}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 max-w-24">
                              <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                <div className={`h-full bg-linear-to-r ${scoreColor.gradient}`} style={{ width: `${user.score}%` }}></div>
                              </div>
                            </div>
                            <span className={`text-sm font-bold ${scoreColor.text}`}>{user.score}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => {
                                setEditingUserId(user.id);
                                setUsername(user.name);
                                setEmail(user.email);
                                setIsEditing(true);
                              }}
                              className="p-1.5 rounded-lg hover:bg-blue-50 transition"
                            >
                              <Edit2 className="w-4 h-4 text-blue-600" />
                            </button>
                            <button
                              onClick={() => deleteUser(user.id)}
                              className="p-1.5 rounded-lg hover:bg-red-50 transition"
                            >
                              <Trash2 className="w-4 h-4 text-red-600" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            
            <TablePagination
              component="div"
              count={filteredUsers.length}
              page={page}
              onPageChange={(_, newPage) => setPage(newPage)}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={(e) => {
                setRowsPerPage(parseInt(e.target.value, 10));
                setPage(0);
              }}
              rowsPerPageOptions={[5, 10, 25, 50]}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredUsers.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((user) => {
              const scoreColor = getScoreColor(user.score);
              return (
                <div key={user.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 hover:shadow-lg transition group">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-linear-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold">
                        {user.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{user.name}</p>
                        <p className="text-xs text-gray-500">{user.email}</p>
                      </div>
                    </div>
                    <Checkbox
                      checked={selectedUsers.has(user.id)}
                      onChange={() => handleSelectUser(user.id)}
                      size="small"
                    />
                  </div>
                  
                  <div className="space-y-2 mb-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Access Code:</span>
                      <code className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">{user.codeInfo.code}</code>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Attempts:</span>
                      <span className="font-semibold">{user.codeInfo.attempts}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Score:</span>
                      <span className={`font-bold ${scoreColor.text}`}>{user.score}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div className={`h-full bg-linear-to-r ${scoreColor.gradient}`} style={{ width: `${user.score}%` }}></div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                    <button 
                      onClick={() => {
                        setEditingUserId(user.id);
                        setUsername(user.name);
                        setEmail(user.email);
                        setIsEditing(true);
                      }}
                      className="p-1.5 rounded-lg hover:bg-blue-50 transition">
                      <Edit2 className="w-4 h-4 text-blue-600" />
                    </button>
                    <button onClick={() => deleteUser(user.id)} className="p-1.5 rounded-lg hover:bg-red-50 transition">
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {filteredUsers.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center py-16 text-gray-500">
            <Search className="w-16 h-16 mb-4 opacity-30" />
            <p className="text-lg font-semibold">No users found</p>
            <p className="text-sm">Try adjusting your search or filters</p>
          </div>
        )}
      </div>

      {/* Download Dialog */}
      <Dialog open={downloadDialogOpen} onClose={() => setDownloadDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <div className="flex items-center gap-2">
            <DownloadCloud className="w-5 h-5 text-emerald-600" />
            <span>Export User Results</span>
          </div>
        </DialogTitle>
        <DialogContent>
          <div className="space-y-4 pt-2">
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">Format</p>
              <RadioGroup row value={downloadFormat} onChange={(e) => setDownloadFormat(e.target.value as any)}>
                <FormControlLabel value="csv" control={<Radio />} label="CSV" />
                <FormControlLabel value="json" control={<Radio />} label="JSON" />
                <FormControlLabel value="pdf" control={<Radio />} label="PDF (Print)" />
              </RadioGroup>
            </div>
            
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">Data Scope</p>
              <RadioGroup value={downloadScope} onChange={(e) => setDownloadScope(e.target.value as any)}>
                <FormControlLabel value="all" control={<Radio />} label="All Users" />
                <FormControlLabel value="filtered" control={<Radio />} label={`Filtered Users (${filteredUsers.length})`} />
                <FormControlLabel value="selected" control={<Radio />} label={`Selected Users (${selectedUsers.size})`} disabled={selectedUsers.size === 0} />
              </RadioGroup>
            </div>
            
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">Additional Options</p>
              <FormGroup>
                <FormControlLabel control={<Checkbox checked={includeStats} onChange={(e) => setIncludeStats(e.target.checked)} />} label="Include Performance Metrics" />
                <FormControlLabel control={<Checkbox checked={includePerformance} onChange={(e) => setIncludePerformance(e.target.checked)} />} label="Include Detailed Stats" />
                <FormControlLabel control={<Checkbox checked={includeTimestamps} onChange={(e) => setIncludeTimestamps(e.target.checked)} />} label="Include Timestamps" />
              </FormGroup>
            </div>
          </div>
        </DialogContent>
        <DialogActions>
          <MuiButton onClick={() => setDownloadDialogOpen(false)}>Cancel</MuiButton>
          <MuiButton onClick={downloadResults} variant="contained" color="primary">
            Download
          </MuiButton>
        </DialogActions>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={isEditing} onClose={() => setIsEditing(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Edit User Details</DialogTitle>
        <DialogContent>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Full Name</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <MuiButton variant="outlined" size="small" onClick={() => handleEditParams(editingUserId!, 'name')}>Update</MuiButton>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Email Address</label>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <MuiButton variant="outlined" size="small" onClick={() => handleEditParams(editingUserId!, 'email')}>Update</MuiButton>
              </div>
            </div>
          </div>
        </DialogContent>
        <DialogActions>
          <MuiButton onClick={() => setIsEditing(false)}>Close</MuiButton>
        </DialogActions>
      </Dialog>
      <Validator/>
    </div>
  );
};

export default UserDashboard;