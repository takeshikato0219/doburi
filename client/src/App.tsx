import React from "react";
import { Route, Switch, useLocation } from "wouter";
import { Toaster } from "sonner";
import { useAuth } from "./hooks/useAuth";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Vehicles from "./pages/Vehicles";
import MyAttendance from "./pages/MyAttendance";
import WorkRecords from "./pages/WorkRecords";
import Analytics from "./pages/Analytics";
import VehicleProductionTime from "./pages/VehicleProductionTime";
import DeliverySchedulesPublic from "./pages/DeliverySchedulesPublic";
import DeliveryDelayedList from "./pages/DeliveryDelayedList";
import VehicleChecks from "./pages/VehicleChecks";
import AttendanceManagement from "./pages/admin/AttendanceManagement";
import WorkRecordManagement from "./pages/admin/WorkRecordManagement";
import VehicleDetail from "./pages/VehicleDetail";
import CSVExport from "./pages/admin/CSVExport";
import ProcessManagement from "./pages/admin/ProcessManagement";
import VehicleTypeManagement from "./pages/admin/VehicleTypeManagement";
import UserManagement from "./pages/admin/UserManagement";
import CheckItemManagement from "./pages/admin/CheckItemManagement";
import BreakTimeManagement from "./pages/admin/BreakTimeManagement";
import StaffSchedule from "./pages/StaffSchedule";
import StaffScheduleManagement from "./pages/admin/StaffScheduleManagement";
import BackupManagement from "./pages/admin/BackupManagement";
import WorkReportIssues from "./pages/WorkReportIssues";
import WorkDisplay from "./pages/admin/WorkDisplay";
import AppLayout from "./components/AppLayout";
import { Button } from "./components/ui/button";

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
    const { user, loading } = useAuth();
    const [, setLocation] = useLocation();

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div>読み込み中...</div>
            </div>
        );
    }

    if (!user) {
        setLocation("/login");
        return null;
    }

    return (
        <AppLayout>
            <Component />
        </AppLayout>
    );
}

function FullscreenRoute({ component: Component }: { component: React.ComponentType }) {
    const { user, loading } = useAuth();
    const [, setLocation] = useLocation();

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div>読み込み中...</div>
            </div>
        );
    }

    if (!user) {
        setLocation("/login");
        return null;
    }

    return (
        <div className="min-h-screen bg-[hsl(var(--background))] p-2 sm:p-4 md:p-6">
            <Component />
        </div>
    );
}

export default function App() {
    return (
        <>
            <Switch>
                <Route path="/login" component={Login} />
                {/* 社外公開用（パスワードなし）の納車スケジュールページ */}
                <Route path="/delivery-schedules-public" component={DeliverySchedulesPublic} />
                <Route path="/">
                    {() => <ProtectedRoute component={Dashboard} />}
                </Route>
                <Route path="/vehicles">
                    {() => <ProtectedRoute component={Vehicles} />}
                </Route>
                <Route path="/vehicles/:id">
                    {() => <ProtectedRoute component={VehicleDetail} />}
                </Route>
                <Route path="/my-attendance">
                    {() => <ProtectedRoute component={MyAttendance} />}
                </Route>
                <Route path="/work-records">
                    {() => <ProtectedRoute component={WorkRecords} />}
                </Route>
                <Route path="/vehicle-production">
                    {() => <ProtectedRoute component={VehicleProductionTime} />}
                </Route>
                <Route path="/analytics">
                    {() => <ProtectedRoute component={Analytics} />}
                </Route>
                <Route path="/vehicle-checks">
                    {() => <ProtectedRoute component={VehicleChecks} />}
                </Route>
                <Route path="/admin/attendance">
                    {() => <ProtectedRoute component={AttendanceManagement} />}
                </Route>
                <Route path="/admin/work-records">
                    {() => <ProtectedRoute component={WorkRecordManagement} />}
                </Route>
                <Route path="/admin/csv-export">
                    {() => <ProtectedRoute component={CSVExport} />}
                </Route>
                <Route path="/admin/processes">
                    {() => <ProtectedRoute component={ProcessManagement} />}
                </Route>
                <Route path="/admin/vehicle-types">
                    {() => <ProtectedRoute component={VehicleTypeManagement} />}
                </Route>
                <Route path="/admin/users">
                    {() => <ProtectedRoute component={UserManagement} />}
                </Route>
                <Route path="/admin/check-items">
                    {() => <ProtectedRoute component={CheckItemManagement} />}
                </Route>
                <Route path="/admin/break-times">
                    {() => <ProtectedRoute component={BreakTimeManagement} />}
                </Route>
                <Route path="/staff-schedule">
                    {() => <FullscreenRoute component={StaffSchedule} />}
                </Route>
                <Route path="/admin/staff-schedule">
                    {() => <ProtectedRoute component={StaffScheduleManagement} />}
                </Route>
                <Route path="/admin/backup">
                    {() => <ProtectedRoute component={BackupManagement} />}
                </Route>
                <Route path="/work-report-issues">
                    {() => <ProtectedRoute component={WorkReportIssues} />}
                </Route>
                <Route path="/admin/work-display">
                    {() => <FullscreenRoute component={WorkDisplay} />}
                </Route>
                <Route>
                    <AppLayout>
                        <div className="min-h-screen flex items-center justify-center">
                            <div className="text-center">
                                <h1 className="text-2xl font-bold mb-4">404 - ページが見つかりません</h1>
                                <p className="text-[hsl(var(--muted-foreground))] mb-4">
                                    お探しのページは存在しないか、移動された可能性があります。
                                </p>
                                <Button onClick={() => window.location.href = "/"}>
                                    ホームに戻る
                                </Button>
                            </div>
                        </div>
                    </AppLayout>
                </Route>
            </Switch>
            <Toaster position="top-center" />
        </>
    );
}
