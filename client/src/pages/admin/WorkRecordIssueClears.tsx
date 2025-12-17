import { useAuth } from "../../hooks/useAuth";
import { trpc } from "../../lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "../../components/ui/table";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { CheckCircle2 } from "lucide-react";
import { happyHuesColors, happyHuesStyles } from "../../styles/happyHues";

export default function WorkRecordIssueClears() {
    const { user } = useAuth();

    // 管理者・準管理者のみアクセス可能
    if (user?.role !== "admin" && user?.role !== "sub_admin") {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center">
                    <p className="text-lg font-semibold">アクセス権限がありません</p>
                    <p className="text-[hsl(var(--muted-foreground))] mt-2">
                        このページは管理者のみがアクセスできます
                    </p>
                </div>
            </div>
        );
    }

    const { data: clears, isLoading, error } = trpc.analytics.getWorkRecordIssueClears.useQuery();

    if (isLoading) {
        return (
            <div className="space-y-6">
                <h1 className="text-2xl font-bold">ふみかチェック一覧</h1>
                <Card>
                    <CardContent className="p-6">
                        <p className="text-[hsl(var(--muted-foreground))]">読み込み中...</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (error) {
        return (
            <div className="space-y-6">
                <h1 className="text-2xl font-bold">ふみかチェック一覧</h1>
                <Card>
                    <CardContent className="p-6">
                        <p className="text-red-600">エラーが発生しました: {error.message}</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div 
            className="min-h-screen p-4 sm:p-6 space-y-6"
            style={{ 
            }}
        >
            <div className="flex items-center gap-2">
                <CheckCircle2 className="h-6 w-6" style={{ color: happyHuesColors.accent4 }} />
                <h1 
                    className="text-2xl font-bold"
                    style={{ color: happyHuesColors.headline, letterSpacing: '-0.02em' }}
                >
                    ふみかチェック一覧
                </h1>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>チェック済み作業記録管理不備</CardTitle>
                </CardHeader>
                <CardContent>
                    {clears && clears.length > 0 ? (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>日付</TableHead>
                                        <TableHead>スタッフ名</TableHead>
                                        <TableHead>チェック日時</TableHead>
                                        <TableHead>チェックした人</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {clears.map((clear) => (
                                        <TableRow key={clear.id}>
                                            <TableCell>
                                                {format(new Date(clear.workDate), "yyyy年MM月dd日(E)", { locale: ja })}
                                            </TableCell>
                                            <TableCell className="font-medium">
                                                {clear.userName}
                                            </TableCell>
                                            <TableCell>
                                                {format(new Date(clear.clearedAt), "yyyy年MM月dd日 HH:mm", { locale: ja })}
                                            </TableCell>
                                            <TableCell>
                                                {clear.clearedByName}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    ) : (
                        <p className="text-[hsl(var(--muted-foreground))] text-center py-8">
                            チェック済みの記録がありません
                        </p>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}


