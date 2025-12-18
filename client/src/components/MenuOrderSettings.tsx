import { useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { ArrowUp, ArrowDown, Save, X } from "lucide-react";
import { toast } from "sonner";
import { happyHuesColors } from "../styles/happyHues";

interface MenuItem {
    icon: string;
    label: string;
    path: string;
    admin: boolean;
    excludeExternal?: boolean;
}

interface MenuOrderSettingsProps {
    menuItems: MenuItem[];
    onSave: (orderedItems: MenuItem[]) => void;
    onCancel: () => void;
}

export default function MenuOrderSettings({ menuItems, onSave, onCancel }: MenuOrderSettingsProps) {
    const { user } = useAuth();
    const [orderedItems, setOrderedItems] = useState<MenuItem[]>(menuItems);

    useEffect(() => {
        // ローカルストレージから保存された順序を読み込む
        const savedOrder = localStorage.getItem("menuOrder");
        if (savedOrder) {
            try {
                const savedPaths = JSON.parse(savedOrder);
                const ordered = savedPaths
                    .map((path: string) => menuItems.find(item => item.path === path))
                    .filter((item: MenuItem | undefined) => item !== undefined) as MenuItem[];
                
                // 新しいメニュー項目があれば追加
                const newItems = menuItems.filter(item => !savedPaths.includes(item.path));
                setOrderedItems([...ordered, ...newItems]);
            } catch (error) {
                setOrderedItems(menuItems);
            }
        } else {
            setOrderedItems(menuItems);
        }
    }, [menuItems]);

    const moveUp = (index: number) => {
        if (index === 0) return;
        const newItems = [...orderedItems];
        [newItems[index - 1], newItems[index]] = [newItems[index], newItems[index - 1]];
        setOrderedItems(newItems);
    };

    const moveDown = (index: number) => {
        if (index === orderedItems.length - 1) return;
        const newItems = [...orderedItems];
        [newItems[index], newItems[index + 1]] = [newItems[index + 1], newItems[index]];
        setOrderedItems(newItems);
    };

    const handleSave = () => {
        const paths = orderedItems.map(item => item.path);
        localStorage.setItem("menuOrder", JSON.stringify(paths));
        onSave(orderedItems);
        toast.success("メニューの順番を保存しました");
    };

    const handleCancel = () => {
        // ローカルストレージから読み込んで元に戻す
        const savedOrder = localStorage.getItem("menuOrder");
        if (savedOrder) {
            try {
                const savedPaths = JSON.parse(savedOrder);
                const ordered = savedPaths
                    .map((path: string) => menuItems.find(item => item.path === path))
                    .filter((item: MenuItem | undefined) => item !== undefined) as MenuItem[];
                const newItems = menuItems.filter(item => !savedPaths.includes(item.path));
                setOrderedItems([...ordered, ...newItems]);
            } catch (error) {
                setOrderedItems(menuItems);
            }
        } else {
            setOrderedItems(menuItems);
        }
        onCancel();
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>メニューの順番を変更</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-2">
                    {orderedItems.map((item, index) => (
                        <div
                            key={item.path}
                            className="flex items-center gap-2 p-3 border rounded-lg bg-white"
                        >
                            <div className="flex-1">
                                <span className="font-medium">{item.label}</span>
                                <span className="text-sm text-gray-500 ml-2">({item.path})</span>
                            </div>
                            <div className="flex gap-1">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => moveUp(index)}
                                    disabled={index === 0}
                                >
                                    <ArrowUp className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => moveDown(index)}
                                    disabled={index === orderedItems.length - 1}
                                >
                                    <ArrowDown className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="flex gap-2 mt-4">
                    <Button onClick={handleSave} className="flex-1">
                        <Save className="h-4 w-4 mr-2" />
                        保存
                    </Button>
                    <Button variant="outline" onClick={handleCancel} className="flex-1">
                        <X className="h-4 w-4 mr-2" />
                        キャンセル
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}

