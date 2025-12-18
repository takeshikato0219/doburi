/**
 * サンプルデータ（データベース接続失敗時のフォールバック用）
 */

export const SAMPLE_VEHICLES = [
    { id: 1, vehicleNumber: "オフィスビル-001", customerName: "東京中央オフィスビル", status: "in_progress", totalMinutes: 5760, category: "一般", vehicleTypeId: 1, desiredDeliveryDate: new Date("2025-03-15"), checkDueDate: new Date("2025-03-10"), hasCoating: "yes", hasLine: "no", hasPreferredNumber: "yes", hasTireReplacement: "no", outsourcingDestination: "外注先A" },
    { id: 2, vehicleNumber: "マンション-002", customerName: "サンライズマンション", status: "in_progress", totalMinutes: 8640, category: "一般", vehicleTypeId: 1, desiredDeliveryDate: new Date("2025-04-20"), checkDueDate: new Date("2025-04-15"), hasCoating: "no", hasLine: "yes", hasPreferredNumber: "no", hasTireReplacement: "summer", outsourcingDestination: "外注先B" },
    { id: 3, vehicleNumber: "工場-003", customerName: "関東製造工場", status: "in_progress", totalMinutes: 4320, category: "一般", vehicleTypeId: 1, desiredDeliveryDate: new Date("2025-02-18"), checkDueDate: new Date("2025-02-12"), hasCoating: "yes", hasLine: "yes", hasPreferredNumber: "yes", hasTireReplacement: "winter", outsourcingDestination: null },
    { id: 4, vehicleNumber: "オフィスビル-004", customerName: "新宿ビジネスタワー", status: "in_progress", totalMinutes: 7200, category: "一般", vehicleTypeId: 1, desiredDeliveryDate: new Date("2025-05-25"), checkDueDate: new Date("2025-05-20"), hasCoating: "no", hasLine: "no", hasPreferredNumber: "no", hasTireReplacement: "no", outsourcingDestination: "外注先C" },
    { id: 5, vehicleNumber: "マンション-005", customerName: "パークサイドマンション", status: "in_progress", totalMinutes: 2880, category: "一般", vehicleTypeId: 1, desiredDeliveryDate: new Date("2025-01-12"), checkDueDate: new Date("2025-01-08"), hasCoating: "yes", hasLine: "no", hasPreferredNumber: "no", hasTireReplacement: "no", outsourcingDestination: null },
    { id: 6, vehicleNumber: "工場-006", customerName: "横浜物流センター", status: "in_progress", totalMinutes: 6480, category: "一般", vehicleTypeId: 1, desiredDeliveryDate: new Date("2025-04-22"), checkDueDate: new Date("2025-04-17"), hasCoating: "no", hasLine: "yes", hasPreferredNumber: "yes", hasTireReplacement: "no", outsourcingDestination: "外注先A" },
    { id: 7, vehicleNumber: "オフィスビル-007", customerName: "品川グランドタワー", status: "in_progress", totalMinutes: 5040, category: "一般", vehicleTypeId: 1, desiredDeliveryDate: new Date("2025-03-16"), checkDueDate: new Date("2025-03-11"), hasCoating: "yes", hasLine: "no", hasPreferredNumber: "no", hasTireReplacement: "summer", outsourcingDestination: "外注先B" },
    { id: 8, vehicleNumber: "マンション-008", customerName: "リバーサイドマンション", status: "in_progress", totalMinutes: 8160, category: "一般", vehicleTypeId: 1, desiredDeliveryDate: new Date("2025-05-28"), checkDueDate: new Date("2025-05-23"), hasCoating: "no", hasLine: "yes", hasPreferredNumber: "yes", hasTireReplacement: "winter", outsourcingDestination: null },
    { id: 9, vehicleNumber: "工場-009", customerName: "千葉食品工場", status: "in_progress", totalMinutes: 4560, category: "一般", vehicleTypeId: 1, desiredDeliveryDate: new Date("2025-02-14"), checkDueDate: new Date("2025-02-09"), hasCoating: "yes", hasLine: "yes", hasPreferredNumber: "no", hasTireReplacement: "no", outsourcingDestination: "外注先C" },
    { id: 10, vehicleNumber: "オフィスビル-010", customerName: "渋谷スクエアビル", status: "in_progress", totalMinutes: 6240, category: "一般", vehicleTypeId: 1, desiredDeliveryDate: new Date("2025-04-19"), checkDueDate: new Date("2025-04-14"), hasCoating: "no", hasLine: "no", hasPreferredNumber: "yes", hasTireReplacement: "no", outsourcingDestination: "外注先A" },
    { id: 11, vehicleNumber: "マンション-011", customerName: "シティパークマンション", status: "in_progress", totalMinutes: 5520, category: "一般", vehicleTypeId: 1, desiredDeliveryDate: new Date("2025-03-17"), checkDueDate: new Date("2025-03-12"), hasCoating: "yes", hasLine: "no", hasPreferredNumber: "no", hasTireReplacement: "summer", outsourcingDestination: "外注先B" },
    { id: 12, vehicleNumber: "工場-012", customerName: "埼玉自動車部品工場", status: "in_progress", totalMinutes: 7680, category: "一般", vehicleTypeId: 1, desiredDeliveryDate: new Date("2025-05-26"), checkDueDate: new Date("2025-05-21"), hasCoating: "no", hasLine: "yes", hasPreferredNumber: "yes", hasTireReplacement: "winter", outsourcingDestination: null },
    { id: 13, vehicleNumber: "オフィスビル-013", customerName: "丸の内ビジネスセンター", status: "in_progress", totalMinutes: 4080, category: "一般", vehicleTypeId: 1, desiredDeliveryDate: new Date("2025-02-13"), checkDueDate: new Date("2025-02-08"), hasCoating: "yes", hasLine: "yes", hasPreferredNumber: "yes", hasTireReplacement: "no", outsourcingDestination: "外注先C" },
    { id: 14, vehicleNumber: "マンション-014", customerName: "フォレストマンション", status: "in_progress", totalMinutes: 6960, category: "一般", vehicleTypeId: 1, desiredDeliveryDate: new Date("2025-04-24"), checkDueDate: new Date("2025-04-19"), hasCoating: "no", hasLine: "no", hasPreferredNumber: "no", hasTireReplacement: "no", outsourcingDestination: "外注先A" },
    { id: 15, vehicleNumber: "工場-015", customerName: "神奈川化学工場", status: "in_progress", totalMinutes: 4800, category: "一般", vehicleTypeId: 1, desiredDeliveryDate: new Date("2025-03-15"), checkDueDate: new Date("2025-03-10"), hasCoating: "yes", hasLine: "no", hasPreferredNumber: "yes", hasTireReplacement: "summer", outsourcingDestination: "外注先B" },
    { id: 16, vehicleNumber: "オフィスビル-016", customerName: "六本木ヒルズオフィス", status: "in_progress", totalMinutes: 8400, category: "一般", vehicleTypeId: 1, desiredDeliveryDate: new Date("2025-05-29"), checkDueDate: new Date("2025-05-24"), hasCoating: "no", hasLine: "yes", hasPreferredNumber: "yes", hasTireReplacement: "winter", outsourcingDestination: null },
    { id: 17, vehicleNumber: "マンション-017", customerName: "オーシャンビューマンション", status: "in_progress", totalMinutes: 3840, category: "一般", vehicleTypeId: 1, desiredDeliveryDate: new Date("2025-01-11"), checkDueDate: new Date("2025-01-06"), hasCoating: "yes", hasLine: "yes", hasPreferredNumber: "no", hasTireReplacement: "no", outsourcingDestination: "外注先C" },
    { id: 18, vehicleNumber: "工場-018", customerName: "茨城電子部品工場", status: "in_progress", totalMinutes: 6720, category: "一般", vehicleTypeId: 1, desiredDeliveryDate: new Date("2025-04-21"), checkDueDate: new Date("2025-04-16"), hasCoating: "no", hasLine: "no", hasPreferredNumber: "yes", hasTireReplacement: "no", outsourcingDestination: "外注先A" },
    { id: 19, vehicleNumber: "オフィスビル-019", customerName: "銀座コマーシャルビル", status: "in_progress", totalMinutes: 5280, category: "一般", vehicleTypeId: 1, desiredDeliveryDate: new Date("2025-03-16"), checkDueDate: new Date("2025-03-11"), hasCoating: "yes", hasLine: "no", hasPreferredNumber: "no", hasTireReplacement: "summer", outsourcingDestination: "外注先B" },
    { id: 20, vehicleNumber: "マンション-020", customerName: "ハイツグリーンマンション", status: "in_progress", totalMinutes: 7440, category: "一般", vehicleTypeId: 1, desiredDeliveryDate: new Date("2025-05-27"), checkDueDate: new Date("2025-05-22"), hasCoating: "no", hasLine: "yes", hasPreferredNumber: "yes", hasTireReplacement: "winter", outsourcingDestination: null },
];

export const SAMPLE_PROCESSES = [
    { id: 1, name: "基礎工事", majorCategory: "基礎" },
    { id: 2, name: "下地工事", majorCategory: "下地" },
    { id: 3, name: "電気工事", majorCategory: "電気" },
    { id: 4, name: "水道工事", majorCategory: "水道" },
    { id: 5, name: "内装工事", majorCategory: "内装" },
    { id: 6, name: "外装工事", majorCategory: "外装" },
];

export function getSampleWorkRecords(userId: number) {
    const baseDate = new Date("2024-12-01T08:00:00+09:00");
    const records = [];
    
    // 20件の車両に対して、各ユーザーが作業記録を持つ
    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
        const workDate = new Date(baseDate);
        workDate.setDate(workDate.getDate() + dayOffset);
        
        for (let recordIdx = 0; recordIdx < 2; recordIdx++) {
            const vehicleId = (dayOffset % 20) + 1;
            const processId = (recordIdx % 6) + 1;
            const workMinutes = 120 + (recordIdx * 120) + (dayOffset * 40);
            
            const startTime = new Date(workDate);
            startTime.setHours(8 + recordIdx * 8, 0, 0, 0);
            
            const endTime = new Date(startTime);
            endTime.setMinutes(endTime.getMinutes() + workMinutes);
            
            records.push({
                id: records.length + 1,
                userId,
                vehicleId,
                processId,
                startTime,
                endTime,
                workDescription: `${SAMPLE_PROCESSES[processId - 1]?.name || "作業"}（${SAMPLE_VEHICLES[vehicleId - 1]?.customerName || "建物"}）`,
                vehicleNumber: SAMPLE_VEHICLES[vehicleId - 1]?.vehicleNumber || "不明",
                processName: SAMPLE_PROCESSES[processId - 1]?.name || "不明",
                durationMinutes: workMinutes,
            });
        }
    }
    
    return records;
}

