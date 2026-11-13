"use client";
import "@/app/components/admin/admin.css";

import {
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  FormGroup,
  Button as MuiButton,
  Radio,
  RadioGroup,
} from "@mui/material";
import { DownloadCloud } from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import {
  filterStudentRecords,
  toggleFilteredSelection,
} from "@/app/components/admin/records-model";
import { StudentRecordsView } from "@/app/components/admin/student-records";
import { useToast } from "@/app/components/toast";
import { CoreService } from "@/app/helpers/api-handler";
import { Users as Person } from "@/app/helpers/factories";

const UserDashboard: React.FC = () => {
  const [users, setUsers] = useState<Person[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<Person[]>([]);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [scoreFilter, setScoreFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("score");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");
  const [downloadDialogOpen, setDownloadDialogOpen] = useState<boolean>(false);
  const [downloadFormat, setDownloadFormat] = useState<"csv" | "json" | "pdf">(
    "csv",
  );
  const [downloadScope, setDownloadScope] = useState<
    "all" | "filtered" | "selected"
  >("all");
  const [selectedUsers, setSelectedUsers] = useState<Set<number>>(new Set());
  const [includeStats, setIncludeStats] = useState<boolean>(true);
  const [includePerformance, setIncludePerformance] = useState<boolean>(true);
  const [includeTimestamps, setIncludeTimestamps] = useState<boolean>(true);
  const [page, setPage] = useState<number>(0);
  const [rowsPerPage, setRowsPerPage] = useState<number>(10);

  const service = React.useMemo(() => new CoreService("adminSession"), []);
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [username, setUsername] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const router = useRouter();
  const [editingUserId, setEditingUserId] = useState<number | null>(null);

  const handleEditParams = async (id: number, key: "email" | "name") => {
    if (saving) return;
    const param = (key === "name" ? username : email).trim();
    if (!param) {
      addToast(
        key === "name" ? "Enter a student name." : "Enter an email address.",
        "warning",
      );
      return;
    }
    if (key === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(param)) {
      addToast("Enter a valid email address.", "warning");
      return;
    }
    setSaving(true);
    try {
      const res = await service.send("/users/api/update-parameter", {
        userId: id,
        key,
        param,
      });
      if (!res.success) {
        addToast(res.message || "Student details could not be saved.", "error");
        return;
      }
      addToast(res.message || "Student details updated.", "success");
      setIsEditing(false);
      setEditingUserId(null);
      await fetchUsers();
    } catch {
      addToast(
        "Student details could not be saved. Please try again.",
        "error",
      );
    } finally {
      setSaving(false);
    }
  };

  const fetchUsers = React.useCallback(async (): Promise<void> => {
    setLoading(true);
    setLoadError("");
    try {
      const res = await service.get("/users/api/find-all-users");
      if (!res.success) {
        setLoadError(
          res.message || "Unable to load student records. Please try again.",
        );
        return;
      }
      if (res.data !== null && !Array.isArray(res.data)) {
        setLoadError(
          "The server returned an unexpected student list. Please try again.",
        );
        return;
      }
      const records = (res.data || []).map((item: Record<string, unknown>) =>
        Person.fromJson(item),
      );
      setUsers(records);
      const ids = new Set(records.map((record: Person) => record.id));
      setSelectedUsers(
        (previous) => new Set([...previous].filter((id) => ids.has(id))),
      );
    } catch {
      setLoadError("Unable to connect to student records. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [service]);

  useEffect(() => {
    try {
      const session = JSON.parse(
        sessionStorage.getItem("adminSession") || "null",
      );
      if (
        session?.type !== "admin" ||
        typeof session.token !== "string" ||
        !session.token.trim()
      ) {
        router.replace("/pages/login");
        return;
      }
      fetchUsers();
    } catch {
      router.replace("/pages/login");
    }
  }, [fetchUsers, router]);

  useEffect(() => {
    setFilteredUsers(
      filterStudentRecords(users, searchTerm, scoreFilter, sortBy, sortOrder),
    );
    setPage(0);
  }, [users, searchTerm, scoreFilter, sortBy, sortOrder]);

  const copyToClipboard = async (text: string, id: number): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(
        () => setCopiedId((current) => (current === id ? null : current)),
        2000,
      );
      addToast("Student access code copied.", "success");
    } catch {
      addToast(
        "The access code could not be copied. Please try again.",
        "error",
      );
    }
  };

  const deleteUser = async (record: Person): Promise<void> => {
    if (
      busyId !== null ||
      !window.confirm(
        "Delete " + record.name + "? This removes their student record.",
      )
    )
      return;
    setBusyId(record.id);
    try {
      const res = await service.delete("/users/api/delete-user", {
        userId: record.id,
      });
      if (res.success) {
        addToast(res.message || "Student record deleted.", "success");
        await fetchUsers();
      } else
        addToast(
          res.message || "Student record could not be deleted.",
          "error",
        );
    } catch {
      addToast(
        "Student record could not be deleted. Please try again.",
        "error",
      );
    } finally {
      setBusyId(null);
    }
  };

  const downloadResults = () => {
    let dataToDownload: any[] = [];

    if (downloadScope === "all") {
      dataToDownload = users;
    } else if (downloadScope === "filtered") {
      dataToDownload = filteredUsers;
    } else {
      dataToDownload = users.filter((u) => selectedUsers.has(u.id));
    }

    if (!dataToDownload.length) {
      addToast(
        "Select at least one student or choose a different export scope.",
        "warning",
      );
      return;
    }

    // --- Grading system: 70+ = A, standard scale below that ---
    function getGrade(score: number): {
      letter: string;
      label: string;
      color: string;
    } {
      if (score >= 70)
        return { letter: "A", label: "Excellent", color: "#059669" };
      if (score >= 60) return { letter: "B", label: "Good", color: "#2563eb" };
      if (score >= 50)
        return { letter: "C", label: "Average", color: "#d97706" };
      if (score >= 40)
        return { letter: "D", label: "Below Average", color: "#ea580c" };
      if (score > 0) return { letter: "F", label: "Fail", color: "#dc2626" };
      return { letter: "—", label: "No Attempt", color: "#94a3b8" };
    }

    function calculateMedian(arr: number[]): number {
      const sorted = [...arr].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 !== 0
        ? sorted[mid]
        : (sorted[mid - 1] + sorted[mid]) / 2;
    }

    // Calculate comprehensive statistics
    const stats = {
      totalUsers: dataToDownload.length,
      averageScore:
        dataToDownload.reduce((sum, u) => sum + u.score, 0) /
        dataToDownload.length,
      medianScore: calculateMedian(dataToDownload.map((u) => u.score)),
      passingRate:
        (dataToDownload.filter((u) => u.score >= 60).length /
          dataToDownload.length) *
        100,
      failingRate:
        (dataToDownload.filter((u) => u.score < 60 && u.score > 0).length /
          dataToDownload.length) *
        100,
      noScoreRate:
        (dataToDownload.filter((u) => u.score === 0).length /
          dataToDownload.length) *
        100,
      totalAttempts: dataToDownload.reduce(
        (sum, u) => sum + (Number(u.codeInfo?.attempts) || 0),
        0,
      ),
      averageAttempts:
        dataToDownload.reduce(
          (sum, u) => sum + (Number(u.codeInfo?.attempts) || 0),
          0,
        ) / dataToDownload.length,
      highestScore: Math.max(...dataToDownload.map((u) => u.score)),
      lowestScore: Math.min(...dataToDownload.map((u) => u.score)),
      gradeDistribution: {
        A: dataToDownload.filter((u) => u.score >= 70).length,
        B: dataToDownload.filter((u) => u.score >= 60 && u.score < 70).length,
        C: dataToDownload.filter((u) => u.score >= 50 && u.score < 60).length,
        D: dataToDownload.filter((u) => u.score >= 40 && u.score < 50).length,
        F: dataToDownload.filter((u) => u.score < 40 && u.score > 0).length,
        NA: dataToDownload.filter((u) => u.score === 0).length,
      },
    };

    const avgGrade = getGrade(stats.averageScore);

    // --- Generate narrative performance insights from the data ---
    function generateInsights(): { title: string; text: string }[] {
      const insights: { title: string; text: string }[] = [];
      const passed = dataToDownload.filter((u) => u.score >= 60);
      const notPassed = dataToDownload.filter(
        (u) => u.score < 60 && u.score > 0,
      );

      // 1. Overall performance vs benchmark
      const benchmarkGap = stats.averageScore - 60;
      insights.push({
        title: "Overall Performance",
        text: `The cohort averaged ${stats.averageScore.toFixed(1)}% (Grade ${avgGrade.letter} — ${avgGrade.label.toLowerCase()}), which is ${benchmarkGap >= 0 ? `${benchmarkGap.toFixed(1)} points above` : `${Math.abs(benchmarkGap).toFixed(1)} points below`} the 60% passing benchmark. The median score of ${stats.medianScore.toFixed(1)}% is ${Math.abs(stats.medianScore - stats.averageScore) < 2 ? "closely aligned with the average, suggesting a fairly even spread of results" : stats.medianScore > stats.averageScore ? "higher than the average, indicating a small number of low scores are pulling the mean down" : "lower than the average, indicating a small number of high scores are pulling the mean up"}.`,
      });

      // 2. Grade distribution shape
      const aPct = (stats.gradeDistribution.A / stats.totalUsers) * 100;
      const strugglingPct =
        ((stats.gradeDistribution.D +
          stats.gradeDistribution.F +
          stats.gradeDistribution.NA) /
          stats.totalUsers) *
        100;
      insights.push({
        title: "Grade Distribution",
        text: `${aPct.toFixed(0)}% of students earned an A grade (70%+), while ${strugglingPct.toFixed(0)}% fall into the D, F, or no-attempt range. ${strugglingPct > aPct ? "This skew toward the lower bands suggests the material or assessment may need review, or that a targeted intervention group should be identified." : aPct > 50 ? "The distribution is skewed toward strong performance, indicating the cohort has a solid grasp of the material overall." : "Results are fairly evenly spread across grade bands, which is typical for a mixed-ability group."}`,
      });

      // 3. Attempts vs outcome
      const avgAttemptsPassed = passed.length
        ? passed.reduce((s, u) => s + (Number(u.codeInfo?.attempts) || 0), 0) /
          passed.length
        : 0;
      const avgAttemptsNotPassed = notPassed.length
        ? notPassed.reduce(
            (s, u) => s + (Number(u.codeInfo?.attempts) || 0),
            0,
          ) / notPassed.length
        : 0;
      insights.push({
        title: "Attempt Patterns",
        text:
          notPassed.length && passed.length
            ? `Students who passed averaged ${avgAttemptsPassed.toFixed(1)} attempts, compared to ${avgAttemptsNotPassed.toFixed(1)} attempts among those who did not. ${avgAttemptsPassed > avgAttemptsNotPassed ? "This suggests repeated attempts are associated with better outcomes — students who kept retrying tended to improve." : "This suggests more attempts alone did not translate into passing scores, so struggling students may need a different kind of support rather than just more retries."}`
            : `The cohort logged ${1} attempts in total, averaging ${1} per student.`,
      });

      // 4. Engagement / no-attempt callout
      if (stats.gradeDistribution.NA > 0) {
        insights.push({
          title: "Engagement Gap",
          text: `${stats.gradeDistribution.NA} student${stats.gradeDistribution.NA === 1 ? " has" : "s have"} not attempted the assessment at all (${stats.noScoreRate.toFixed(1)}% of this group). Following up with this group directly is likely to have a bigger impact on the overall pass rate than adjusting difficulty for those who have already engaged.`,
        });
      }

      // 5. Spread / outliers
      const spread = stats.highestScore - stats.lowestScore;
      insights.push({
        title: "Performance Spread",
        text: `Scores range from ${stats.lowestScore}% to ${stats.highestScore}%, a spread of ${spread} points. ${spread > 60 ? "This wide range points to significant variation in readiness within the group, and may warrant differentiated support rather than a one-size-fits-all approach." : "This relatively tight range suggests the group is fairly uniform in readiness."}`,
      });

      return insights;
    }

    const insights = generateInsights();

    if (downloadFormat === "csv") {
      const headers = [
        "ID",
        "Name",
        "Email",
        "Access Code",
        "Attempts",
        "Score (%)",
        "Grade",
        "Status",
      ];
      const csvRows: string[] = [headers.join(",")];

      dataToDownload.forEach((user) => {
        const grade = getGrade(user.score);
        const row = [
          user.id,
          `"${user.name}"`,
          `"${user.email}"`,
          `"${user.codeInfo.code}"`,
          Number(user.codeInfo?.attempts) || 0,
          user.score.toFixed(1),
          `"${grade.letter} - ${grade.label}"`,
          `"${user.score >= 60 ? "PASS" : user.score > 0 ? "FAIL" : "NO ATTEMPT"}"`,
        ];
        csvRows.push(row.join(","));
      });

      csvRows.push("");
      csvRows.push('"SUMMARY STATISTICS"');
      csvRows.push(`"Total Users",${stats.totalUsers}`);
      csvRows.push(`"Average Score",${stats.averageScore.toFixed(1)}%`);
      csvRows.push(`"Average Grade",${avgGrade.letter}`);
      csvRows.push(`"Median Score",${stats.medianScore.toFixed(1)}%`);
      csvRows.push(`"Passing Rate",${stats.passingRate.toFixed(1)}%`);
      csvRows.push(`"Highest Score",${stats.highestScore}%`);
      csvRows.push(`"Lowest Score",${stats.lowestScore}%`);
      csvRows.push(`"Total Attempts",${stats.totalAttempts}`);
      csvRows.push("");
      csvRows.push('"INSIGHTS"');
      insights.forEach((i) => {
        csvRows.push(`"${i.title}","${i.text.replace(/"/g, "'")}"`);
      });

      const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `user_performance_report_${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      addToast("CSV file downloaded successfully!", "success");
    } else if (downloadFormat === "json") {
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
          gradeDistribution: stats.gradeDistribution,
        },
        insights,
        users: dataToDownload.map((user) => {
          const grade = getGrade(user.score);
          return {
            id: user.id,
            name: user.name,
            email: user.email,
            accessCode: user.codeInfo.code,
            attempts: Number(user.codeInfo?.attempts) || 0,
            score: user.score,
            grade: grade.letter,
            gradeLabel: grade.label,
            status:
              user.score >= 60
                ? "PASS"
                : user.score > 0
                  ? "FAIL"
                  : "NO ATTEMPT",
          };
        }),
      };

      const blob = new Blob([JSON.stringify(jsonData, null, 2)], {
        type: "application/json",
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `user_performance_report_${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      addToast("JSON file downloaded successfully!", "success");
    } else {
      // PDF Export - Modern Professional Report
      const printWindow = window.open("", "_blank", "width=1200,height=800");
      if (printWindow) {
        const sortedUsers = [...dataToDownload].sort(
          (a, b) => b.score - a.score,
        );
        const needsAttentionUsers = sortedUsers.filter(
          (user) => user.score < 60,
        );

        // ===== Individual vs. Cohort comparison data =====
        const cohortAvg = stats.averageScore;
        const cohortMedian = stats.medianScore;
        const cohortHighest = stats.highestScore;
        const cohortLowest = stats.lowestScore;
        const cohortAttemptsAvg = stats.averageAttempts;

        // Rank map (1 = best score)
        const rankMap = new Map<number, number>();
        sortedUsers.forEach((u, i) => {
          rankMap.set(u.id, i + 1);
        });

        // Percentile: % of cohort this student scored >= to (midpoint method)
        function percentileOf(score: number): number {
          if (!dataToDownload.length) return 0;
          const below = dataToDownload.filter((u) => u.score < score).length;
          const equal = dataToDownload.filter((u) => u.score === score).length;
          return ((below + equal / 2) / dataToDownload.length) * 100;
        }

        const comparisonRows = sortedUsers.map((user) => {
          const delta = user.score - cohortAvg;
          const rank = rankMap.get(user.id) ?? 0;
          const percentile = percentileOf(user.score);
          const grade = getGrade(user.score);

          const dir = delta > 1 ? "up" : delta < -1 ? "down" : "flat";
          const deltaText =
            dir === "flat"
              ? "On par"
              : `${delta > 0 ? "+" : ""}${delta.toFixed(1)} pts`;

          let note = "";
          if (user.score === 0) {
            note = `<strong>No attempt recorded.</strong> This student has not engaged with the assessment — the single biggest lever for improving the cohort pass rate.`;
          } else if (user.score >= cohortHighest) {
            note = `<strong>Top of the cohort.</strong> Ranked #${rank} of ${dataToDownload.length} (${percentile.toFixed(0)}th percentile), ${delta.toFixed(1)} points above the class average.`;
          } else if (user.score >= cohortAvg + 10) {
            note = `<strong>Well above average.</strong> Ranked #${rank} of ${dataToDownload.length} (${percentile.toFixed(0)}th percentile), ${delta.toFixed(1)} points above the class average of ${cohortAvg.toFixed(1)}%.`;
          } else if (user.score >= cohortAvg) {
            note = `<strong>Above average.</strong> Ranked #${rank} of ${dataToDownload.length} (${percentile.toFixed(0)}th percentile), performing ${delta.toFixed(1)} points better than the cohort mean.`;
          } else if (user.score >= 60) {
            note = `<strong>Passing but below average.</strong> Ranked #${rank} of ${dataToDownload.length} (${percentile.toFixed(0)}th percentile), ${Math.abs(delta).toFixed(1)} points below the class average. Still a passing grade (${grade.letter}).`;
          } else if (user.score > 0) {
            note = `<strong>Below the pass mark.</strong> Ranked #${rank} of ${dataToDownload.length} (${percentile.toFixed(0)}th percentile), ${Math.abs(delta).toFixed(1)} points below the class average and ${(60 - user.score).toFixed(1)} points short of passing.`;
          } else {
            note = `<strong>No score recorded.</strong>`;
          }

          return { user, delta, deltaText, dir, rank, percentile, grade, note };
        });

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

            /* Student Comparison */
            .comparison-panel {
              background: #ffffff;
              border: 1px solid #e2e8f0;
              border-radius: 10px;
              padding: 20px;
              margin-bottom: 22px;
            }
            .comparison-panel h3 {
              font-size: 12.5px;
              margin: 0 0 6px 0;
              color: #0f172a;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 0.4px;
            }
            .comparison-subtitle {
              font-size: 11px;
              color: #64748b;
              margin-bottom: 16px;
            }
            .comparison-legend {
              display: flex;
              gap: 16px;
              font-size: 10.5px;
              color: #64748b;
              margin-bottom: 14px;
              flex-wrap: wrap;
            }
            .comparison-legend span { display: inline-flex; align-items: center; gap: 5px; }
            .comparison-legend .dot {
              width: 9px; height: 9px; border-radius: 3px; display: inline-block;
            }

            /* Comparison bars */
            .comp-row {
              display: grid;
              grid-template-columns: 140px 1fr 60px;
              align-items: center;
              gap: 10px;
              padding: 6px 0;
              border-bottom: 1px solid #f8fafc;
              page-break-inside: avoid;
              break-inside: avoid;
            }
            .comp-row:last-child { border-bottom: none; }
            .comp-name {
              font-size: 11.5px;
              font-weight: 600;
              color: #0f172a;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
            .comp-name small {
              display: block;
              font-weight: 400;
              color: #94a3b8;
              font-size: 9.5px;
            }
            .comp-track {
              position: relative;
              height: 18px;
              background: #f1f5f9;
              border-radius: 4px;
              overflow: hidden;
            }
            .comp-fill {
              position: absolute;
              left: 0; top: 0; bottom: 0;
              border-radius: 4px;
              display: flex;
              align-items: center;
              justify-content: flex-end;
              padding-right: 6px;
              font-size: 9.5px;
              font-weight: 700;
              color: #fff;
              min-width: 22px;
            }
            .comp-avg-line {
              position: absolute;
              top: -2px;
              bottom: -2px;
              width: 2px;
              background: #0f172a;
              z-index: 2;
            }
            .comp-delta {
              font-size: 11px;
              font-weight: 700;
              text-align: right;
              white-space: nowrap;
            }
            .comp-delta.up { color: #059669; }
            .comp-delta.down { color: #dc2626; }
            .comp-delta.flat { color: #64748b; }

            /* Per-student comparison cards */
            .comp-grid {
              display: grid;
              grid-template-columns: repeat(2, minmax(0, 1fr));
              gap: 10px;
              margin-top: 18px;
            }
            .comp-card {
              border: 1px solid #e2e8f0;
              border-radius: 9px;
              padding: 12px 14px;
              background: #f8fafc;
              page-break-inside: avoid;
              break-inside: avoid;
              min-width: 0;
            }
            .comp-card-head {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              gap: 8px;
              margin-bottom: 8px;
            }
            .comp-card-name {
              font-size: 12px;
              font-weight: 700;
              color: #0f172a;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
            .comp-card-email {
              font-size: 9.5px;
              color: #94a3b8;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
            .comp-card-score {
              font-size: 15px;
              font-weight: 800;
              flex-shrink: 0;
            }
            .comp-metrics {
              display: grid;
              grid-template-columns: repeat(3, minmax(0, 1fr));
              gap: 6px;
              margin-bottom: 8px;
            }
            .comp-metric {
              background: #fff;
              border: 1px solid #eef2f7;
              border-radius: 6px;
              padding: 5px 7px;
              min-width: 0;
            }
            .comp-metric-label {
              font-size: 8.5px;
              text-transform: uppercase;
              color: #94a3b8;
              font-weight: 700;
              letter-spacing: 0.3px;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
            .comp-metric-value {
              font-size: 11.5px;
              font-weight: 700;
              color: #0f172a;
              white-space: nowrap;
            }
            .comp-note {
              font-size: 10.5px;
              color: #475569;
              line-height: 1.5;
              margin-top: 6px;
              padding-top: 6px;
              border-top: 1px dashed #e2e8f0;
            }
            .comp-note strong { color: #0f172a; }

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
              .stats-grid, .performance-section, .performer-row, .insight-item, tr, .footer,
              .comp-row, .comp-card {
                page-break-inside: avoid;
                break-inside: avoid;
              }
              thead { display: table-header-group; }
              .header, .stats-grid { page-break-after: avoid; }
              .header {
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              .grade-badge, .status-badge, .dist-fill, .performer-rank, .grade-pill, .insight-marker,
              .comp-fill, .comp-avg-line, .comp-metric {
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
                <div class="date">${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</div>
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
                <div class="stat-sub">${stats.passingRate >= 70 ? "Strong cohort" : stats.passingRate >= 50 ? "Acceptable" : "Needs attention"}</div>
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
                  A: {
                    count: stats.gradeDistribution.A,
                    color: "#059669",
                    range: "70-100%",
                  },
                  B: {
                    count: stats.gradeDistribution.B,
                    color: "#2563eb",
                    range: "60-69%",
                  },
                  C: {
                    count: stats.gradeDistribution.C,
                    color: "#d97706",
                    range: "50-59%",
                  },
                  D: {
                    count: stats.gradeDistribution.D,
                    color: "#ea580c",
                    range: "40-49%",
                  },
                  F: {
                    count: stats.gradeDistribution.F,
                    color: "#dc2626",
                    range: "1-39%",
                  },
                  "—": {
                    count: stats.gradeDistribution.NA,
                    color: "#94a3b8",
                    range: "No attempt",
                  },
                })
                  .map(
                    ([letter, data]) => `
                  <div class="dist-bar">
                    <div class="dist-label"><span class="grade-pill" style="background:${data.color}; width:16px; height:16px; font-size:10px;">${letter}</span> ${data.range}</div>
                    <div class="dist-track">
                      <div class="dist-fill" style="width: ${stats.totalUsers ? (data.count / stats.totalUsers) * 100 : 0}%; background: ${data.color}">
                        ${data.count > 0 ? data.count : ""}
                      </div>
                    </div>
                  </div>
                `,
                  )
                  .join("")}
              </div>

              <div class="panel">
                <h3>Top &amp; Bottom Performers</h3>
                <div class="section-divider">Top 3</div>
                ${sortedUsers
                  .slice(0, 3)
                  .map(
                    (user, index) => `
                  <div class="performer-row">
                    <div class="performer-rank">${index + 1}</div>
                    <div class="performer-info">
                      <div class="performer-name">${user.name}</div>
                      <div class="performer-email">${user.email}</div>
                    </div>
                    <div class="performer-score" style="color:#059669;">${user.score}%</div>
                  </div>
                `,
                  )
                  .join("")}
                ${
                  needsAttentionUsers.length > 0
                    ? `<div class="section-divider">Needs Attention</div>
                ${needsAttentionUsers
                  .slice(-3)
                  .reverse()
                  .map(
                    (user) => `
                  <div class="performer-row">
                    <div class="performer-rank" style="background:#dc2626;">${sortedUsers.indexOf(user) + 1}</div>
                    <div class="performer-info">
                      <div class="performer-name">${user.name}</div>
                      <div class="performer-email">${user.email}</div>
                    </div>
                    <div class="performer-score" style="color:#dc2626;">${user.score}%</div>
                  </div>
                `,
                  )
                  .join("")}`
                    : ""
                }
              </div>
            </div>

            <!-- Insights -->
            <div class="insights-panel">
              <h3>Performance Insights &amp; Recommendations</h3>
              ${insights
                .map(
                  (insight, i) => `
                <div class="insight-item">
                  <div class="insight-marker">${i + 1}</div>
                  <div class="insight-body">
                    <div class="insight-title">${insight.title}</div>
                    <div class="insight-text">${insight.text}</div>
                  </div>
                </div>
              `,
                )
                .join("")}
            </div>

            <!-- Student Comparison: Individual vs. Cohort -->
            <div class="comparison-panel">
              <h3>Student Comparison — Individual vs. Cohort</h3>
              <div class="comparison-subtitle">
                Each student's score plotted against the cohort average (${cohortAvg.toFixed(1)}%).
                The vertical line on each bar marks the class mean.
              </div>
              <div class="comparison-legend">
                <span><span class="dot" style="background:#059669;"></span> Above cohort average</span>
                <span><span class="dot" style="background:#dc2626;"></span> Below cohort average</span>
                <span><span class="dot" style="background:#0f172a;"></span> Cohort average (${cohortAvg.toFixed(1)}%)</span>
              </div>

              ${comparisonRows
                .map(({ user, delta, deltaText, dir }) => {
                  const fillColor = delta >= 0 ? "#059669" : "#dc2626";
                  return `
                  <div class="comp-row">
                    <div class="comp-name">
                      ${user.name}
                      <small>#${user.id} · ${user.email}</small>
                    </div>
                    <div class="comp-track">
                      <div class="comp-fill" style="width:${Math.max(user.score, 2)}%; background:${fillColor};">
                        ${user.score > 8 ? user.score + "%" : ""}
                      </div>
                      <div class="comp-avg-line" style="left:${cohortAvg}%;"></div>
                    </div>
                    <div class="comp-delta ${dir}">${deltaText}</div>
                  </div>
                `;
                })
                .join("")}

              <div class="comp-grid">
                ${comparisonRows
                  .map(({ user, delta, rank, percentile, grade, note }) => {
                    const deltaColor = delta >= 0 ? "#059669" : "#dc2626";
                    const shortfall =
                      user.score > 0 && user.score < 60
                        ? `${(60 - user.score).toFixed(1)} pts`
                        : user.score >= 60
                          ? "Passed"
                          : "—";
                    return `
                    <div class="comp-card">
                      <div class="comp-card-head">
                        <div style="min-width:0;">
                          <div class="comp-card-name">${user.name}</div>
                          <div class="comp-card-email">${user.email}</div>
                        </div>
                        <div class="comp-card-score" style="color:${grade.color};">${user.score}%</div>
                      </div>
                      <div class="comp-metrics">
                        <div class="comp-metric">
                          <div class="comp-metric-label">Rank</div>
                          <div class="comp-metric-value">#${rank} / ${dataToDownload.length}</div>
                        </div>
                        <div class="comp-metric">
                          <div class="comp-metric-label">Percentile</div>
                          <div class="comp-metric-value">${percentile.toFixed(0)}th</div>
                        </div>
                        <div class="comp-metric">
                          <div class="comp-metric-label">vs Avg</div>
                          <div class="comp-metric-value" style="color:${deltaColor};">
                            ${delta > 0 ? "+" : ""}${delta.toFixed(1)}
                          </div>
                        </div>
                        <div class="comp-metric">
                          <div class="comp-metric-label">Attempts</div>
                          <div class="comp-metric-value">${Number(user.codeInfo?.attempts) || 0}</div>
                        </div>
                        <div class="comp-metric">
                          <div class="comp-metric-label">Grade</div>
                          <div class="comp-metric-value" style="color:${grade.color};">${grade.letter}</div>
                        </div>
                        <div class="comp-metric">
                          <div class="comp-metric-label">To Pass</div>
                          <div class="comp-metric-value">${shortfall}</div>
                        </div>
                      </div>
                      <div class="comp-note">${note}</div>
                    </div>
                  `;
                  })
                  .join("")}
              </div>
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
                  ${sortedUsers
                    .map((user, index) => {
                      const grade = getGrade(user.score);
                      return `
                    <tr>
                      <td>${index + 1}</td>
                      <td><strong>${user.name}</strong></td>
                      <td style="color:#94a3b8; font-size:10.5px;">${user.email}</td>
                      
                      
                      <td style="font-weight:700;">${user.score}%</td>
                      <td><span class="grade-badge" style="background:${grade.color}20; color:${grade.color};">${grade.letter} · ${grade.label}</span></td>
                      <td><span class="status-badge ${user.score >= 60 ? "status-pass" : user.score > 0 ? "status-fail" : "status-no-attempt"}">${user.score >= 60 ? "Pass" : user.score > 0 ? "Fail" : "No attempt"}</span></td>
                    </tr>
                  `;
                    })
                    .join("")}
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
        addToast("Professional PDF report generated successfully!", "success");
      }
    }

    setDownloadDialogOpen(false);
  };

  const handleSelectAll = () =>
    setSelectedUsers((previous) =>
      toggleFilteredSelection(
        previous,
        filteredUsers.map((user) => user.id),
      ),
    );

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
    <div>
      <StudentRecordsView
        users={users}
        filtered={filteredUsers}
        loading={loading}
        error={loadError}
        search={searchTerm}
        scoreFilter={scoreFilter}
        sortBy={sortBy}
        sortOrder={sortOrder}
        view={viewMode}
        selected={selectedUsers}
        copiedId={copiedId}
        busyId={busyId}
        page={page}
        size={rowsPerPage}
        onSearch={setSearchTerm}
        onFilter={setScoreFilter}
        onSort={setSortBy}
        onOrder={() =>
          setSortOrder((value) => (value === "desc" ? "asc" : "desc"))
        }
        onView={setViewMode}
        onSelect={handleSelectUser}
        onSelectAll={handleSelectAll}
        onClear={() => setSelectedUsers(new Set())}
        onPage={setPage}
        onSize={(value) => {
          setRowsPerPage(value);
          setPage(0);
        }}
        onRefresh={() => void fetchUsers()}
        onExport={() => {
          setDownloadScope(selectedUsers.size ? "selected" : "all");
          setDownloadDialogOpen(true);
        }}
        onEdit={(user) => {
          setEditingUserId(user.id);
          setUsername(user.name);
          setEmail(user.email);
          setIsEditing(true);
        }}
        onDelete={(user) => void deleteUser(user)}
        onCopy={(user) => void copyToClipboard(user.codeInfo.code, user.id)}
      />

      {/* Download Dialog */}
      <Dialog
        open={downloadDialogOpen}
        onClose={() => setDownloadDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
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
              <RadioGroup
                row
                value={downloadFormat}
                onChange={(e) => setDownloadFormat(e.target.value as any)}
              >
                <FormControlLabel value="csv" control={<Radio />} label="CSV" />
                <FormControlLabel
                  value="json"
                  control={<Radio />}
                  label="JSON"
                />
                <FormControlLabel
                  value="pdf"
                  control={<Radio />}
                  label="PDF (Print)"
                />
              </RadioGroup>
            </div>

            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">
                Data Scope
              </p>
              <RadioGroup
                value={downloadScope}
                onChange={(e) => setDownloadScope(e.target.value as any)}
              >
                <FormControlLabel
                  value="all"
                  control={<Radio />}
                  label="All Users"
                />
                <FormControlLabel
                  value="filtered"
                  control={<Radio />}
                  label={`Filtered Users (${filteredUsers.length})`}
                />
                <FormControlLabel
                  value="selected"
                  control={<Radio />}
                  label={`Selected Users (${selectedUsers.size})`}
                  disabled={selectedUsers.size === 0}
                />
              </RadioGroup>
            </div>

            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">
                Additional Options
              </p>
              <FormGroup>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={includeStats}
                      onChange={(e) => setIncludeStats(e.target.checked)}
                    />
                  }
                  label="Include Performance Metrics"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={includePerformance}
                      onChange={(e) => setIncludePerformance(e.target.checked)}
                    />
                  }
                  label="Include Detailed Stats"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={includeTimestamps}
                      onChange={(e) => setIncludeTimestamps(e.target.checked)}
                    />
                  }
                  label="Include Timestamps"
                />
              </FormGroup>
            </div>
          </div>
        </DialogContent>
        <DialogActions>
          <MuiButton onClick={() => setDownloadDialogOpen(false)}>
            Cancel
          </MuiButton>
          <MuiButton
            onClick={downloadResults}
            variant="contained"
            color="primary"
          >
            Download
          </MuiButton>
        </DialogActions>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog
        open={isEditing}
        onClose={() => {
          if (!saving) setIsEditing(false);
        }}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Edit student details</DialogTitle>
        <DialogContent>
          <p className="records-edit-help">
            Update one field at a time. Changes are saved to the student record.
          </p>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <label
                htmlFor="record-student-name"
                className="text-sm font-medium text-gray-700"
              >
                Full name
              </label>
              <div className="flex gap-2">
                <input
                  id="record-student-name"
                  disabled={saving}
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <MuiButton
                  variant="outlined"
                  size="small"
                  disabled={saving || editingUserId === null}
                  onClick={() => handleEditParams(editingUserId!, "name")}
                >
                  Update
                </MuiButton>
              </div>
            </div>
            <div className="space-y-2">
              <label
                htmlFor="record-student-email"
                className="text-sm font-medium text-gray-700"
              >
                Email address
              </label>
              <div className="flex gap-2">
                <input
                  id="record-student-email"
                  disabled={saving}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <MuiButton
                  variant="outlined"
                  size="small"
                  disabled={saving || editingUserId === null}
                  onClick={() => handleEditParams(editingUserId!, "email")}
                >
                  Update
                </MuiButton>
              </div>
            </div>
          </div>
        </DialogContent>
        <DialogActions>
          <MuiButton disabled={saving} onClick={() => setIsEditing(false)}>
            Close
          </MuiButton>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default UserDashboard;
