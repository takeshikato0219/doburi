import { useState, useRef, useEffect } from "react";
import { trpc } from "../lib/trpc";
import { Button } from "./ui/button";
import { format } from "date-fns";
import { MessageCircle, Send, Trash2, Image as ImageIcon, ChevronDown, ChevronUp, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../hooks/useAuth";

export function VehicleChat({ vehicleId, canEdit }: { vehicleId: number; canEdit: boolean }) {
    const { user } = useAuth();
    const [chatMessage, setChatMessage] = useState("");
    const [replyingTo, setReplyingTo] = useState<number | null>(null);
    const [isOpen, setIsOpen] = useState(false);
    const [selectedImages, setSelectedImages] = useState<string[]>([]);
    const [uploadingImages, setUploadingImages] = useState<string[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const { data: chats, refetch: refetchChats } = trpc.deliverySchedules.getChats.useQuery({
        deliveryScheduleId: vehicleId,
    });

    const uploadImageMutation = trpc.deliverySchedules.uploadChatImage.useMutation();
    const markAsReadMutation = trpc.deliverySchedules.markChatAsRead.useMutation();

    const createChatMutation = trpc.deliverySchedules.createChat.useMutation({
        onSuccess: () => {
            setChatMessage("");
            setReplyingTo(null);
            setSelectedImages([]);
            refetchChats();
        },
        onError: (e) => toast.error(e.message || "コメントの投稿に失敗しました"),
    });

    const deleteChatMutation = trpc.deliverySchedules.deleteChat.useMutation({
        onSuccess: () => {
            toast.success("コメントを削除しました");
            refetchChats();
        },
        onError: (e) => toast.error(e.message || "コメントの削除に失敗しました"),
    });

    // 未読コメント数を計算
    const unreadCount = chats?.filter((chat: any) => chat.isUnread).length || 0;

    // チャットを開いたときに未読を既読にする
    useEffect(() => {
        if (isOpen && chats && user) {
            const unreadChats = chats.filter((chat: any) => chat.isUnread);
            if (unreadChats.length > 0) {
                unreadChats.forEach((chat: any) => {
                    markAsReadMutation.mutate({ chatId: chat.id });
                });
                // 少し遅延して再取得（既読状態を反映）
                setTimeout(() => {
                    refetchChats();
                }, 500);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, chats, user]);

    // 画像選択ハンドラー
    const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        const fileArray = Array.from(files);
        const validFiles = fileArray.filter((file) => file.type.startsWith("image/"));

        if (validFiles.length === 0) {
            toast.error("画像ファイルのみアップロードできます");
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
            return;
        }

        // 各ファイルを順次処理
        for (const file of validFiles) {
            // プレビュー用のbase64を先に追加
            const previewBase64 = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.readAsDataURL(file);
            });

            setSelectedImages((prev) => [...prev, previewBase64]);
            setUploadingImages((prev) => [...prev, file.name]);

            try {
                // アップロード
                const result = await uploadImageMutation.mutateAsync({
                    fileData: previewBase64,
                    fileType: file.type as "image/jpeg" | "image/jpg" | "image/png",
                });

                // プレビューをURLに置き換え
                setSelectedImages((prev) => {
                    const index = prev.findIndex((img) => img === previewBase64);
                    if (index !== -1) {
                        const updated = [...prev];
                        updated[index] = result.fileUrl;
                        return updated;
                    }
                    return prev;
                });
            } catch (error) {
                toast.error(`${file.name}のアップロードに失敗しました`);
                // 失敗したプレビューを削除
                setSelectedImages((prev) => prev.filter((img) => img !== previewBase64));
            } finally {
                setUploadingImages((prev) => prev.filter((name) => name !== file.name));
            }
        }

        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    const removeImage = (index: number) => {
        setSelectedImages((prev) => prev.filter((_, i) => i !== index));
    };

    return (
        <div className="border-t pt-2 mt-2">
            {/* 折りたたみボタン */}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between gap-2 p-2 hover:bg-[hsl(var(--muted))] rounded-lg transition-colors"
            >
                <div className="flex items-center gap-2">
                    <MessageCircle className="h-4 w-4" />
                    <span className="text-xs sm:text-sm font-semibold">コメント</span>
                    {unreadCount > 0 && (
                        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold">
                            {unreadCount}
                        </span>
                    )}
                </div>
                {isOpen ? (
                    <ChevronUp className="h-4 w-4" />
                ) : (
                    <ChevronDown className="h-4 w-4" />
                )}
            </button>

            {isOpen && (
                <div className="space-y-2 pt-2">

            {/* 返信先コメント表示 */}
            {replyingTo && chats && (() => {
                const parentChat = chats.find((c: any) => c.id === replyingTo);
                return parentChat ? (
                    <div className="bg-[hsl(var(--muted))] p-2 rounded-lg mb-2 flex items-start justify-between">
                        <div className="flex-1">
                            <p className="text-xs text-[hsl(var(--muted-foreground))] mb-1">
                                {parentChat.userName || `ユーザーID: ${parentChat.userId}`}に返信:
                            </p>
                            <p className="text-sm line-clamp-2">{parentChat.message}</p>
                        </div>
                        <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 flex-shrink-0"
                            onClick={() => setReplyingTo(null)}
                        >
                            <span className="text-xs">×</span>
                        </Button>
                    </div>
                ) : null;
            })()}

                    {/* 選択された画像のプレビュー */}
                    {selectedImages.length > 0 && (
                        <div className="flex flex-wrap gap-2 p-2 bg-[hsl(var(--muted))] rounded-lg">
                            {selectedImages.map((img, index) => (
                                <div key={index} className="relative">
                                    <img
                                        src={img.startsWith("data:") ? img : `${window.location.origin}${img}`}
                                        alt={`プレビュー ${index + 1}`}
                                        className="w-20 h-20 object-cover rounded border border-[hsl(var(--border))]"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => removeImage(index)}
                                        className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-[10px] hover:bg-red-600"
                                    >
                                        <X className="h-3 w-3" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* チャット投稿フォーム */}
                    <div className="flex gap-2">
                        <div className="flex-1 flex flex-col gap-2">
                            <textarea
                                value={chatMessage}
                                onChange={(e) => setChatMessage(e.target.value)}
                                placeholder={replyingTo ? "返信を入力..." : "コメントを入力..."}
                                className="flex-1 min-h-[60px] p-2 border border-[hsl(var(--border))] rounded-lg text-xs resize-none"
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                                        e.preventDefault();
                                        if (chatMessage.trim() || selectedImages.length > 0) {
                                            createChatMutation.mutate({
                                                deliveryScheduleId: vehicleId,
                                                message: chatMessage.trim(),
                                                parentId: replyingTo || undefined,
                                                imageUrls: selectedImages.filter((img) => !img.startsWith("data:")),
                                            });
                                        }
                                    }
                                }}
                            />
                            <div className="flex items-center gap-2">
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleImageSelect}
                                    accept="image/jpeg,image/jpg,image/png"
                                    multiple
                                    className="hidden"
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={uploadingImages.length > 0}
                                    className="text-xs"
                                >
                                    <ImageIcon className="h-3 w-3 mr-1" />
                                    画像
                                </Button>
                            </div>
                        </div>
                        <Button
                            onClick={() => {
                                if (chatMessage.trim() || selectedImages.length > 0) {
                                    createChatMutation.mutate({
                                        deliveryScheduleId: vehicleId,
                                        message: chatMessage.trim(),
                                        parentId: replyingTo || undefined,
                                        imageUrls: selectedImages.filter((img) => !img.startsWith("data:")),
                                    });
                                }
                            }}
                            disabled={(!chatMessage.trim() && selectedImages.length === 0) || createChatMutation.isPending}
                            className="self-end"
                            size="sm"
                        >
                            <Send className="h-3 w-3" />
                        </Button>
                    </div>

                    {/* チャット履歴 */}
                    <div className="space-y-1 max-h-[300px] overflow-y-auto border border-[hsl(var(--border))] rounded-lg p-2">
                        {chats && chats.length > 0 ? (
                            chats.map((chat: any) => (
                                <div
                                    key={chat.id}
                                    className={`flex items-start gap-2 p-1.5 hover:bg-[hsl(var(--muted))]/50 rounded ${chat.parentId ? "ml-4 border-l-2 border-[hsl(var(--border))] pl-2" : ""} ${chat.isUnread ? "bg-blue-50 border-blue-200" : ""}`}
                                >
                                    <div className="flex-1 min-w-0">
                                        {/* 未読マーカー */}
                                        {chat.isUnread && (
                                            <div className="flex items-center gap-1 mb-1">
                                                <span className="w-2 h-2 rounded-full bg-red-500"></span>
                                                <span className="text-[10px] text-red-600 font-semibold">新着</span>
                                            </div>
                                        )}

                                        {/* 返信先コメント表示 */}
                                        {chat.parentId && chat.parentUserName && (
                                            <div className="mb-1 p-1.5 bg-[hsl(var(--muted))] rounded text-[10px]">
                                                <span className="text-[hsl(var(--muted-foreground))]">
                                                    {chat.parentUserName}への返信:
                                                </span>
                                                <p className="text-[hsl(var(--muted-foreground))] line-clamp-2 mt-0.5">
                                                    {chat.parentMessage}
                                                </p>
                                            </div>
                                        )}

                                        <div className="flex items-center gap-1.5 mb-0.5">
                                            <span className="font-semibold text-[11px]">
                                                {chat.userName || `ユーザーID: ${chat.userId}`}
                                            </span>
                                            <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
                                                {format(new Date(chat.createdAt), "MM/dd HH:mm")}
                                            </span>
                                        </div>
                                        {chat.message && (
                                            <p className="text-xs whitespace-pre-wrap break-words mb-1">{chat.message}</p>
                                        )}
                                        {/* 画像表示 */}
                                        {chat.imageUrls && chat.imageUrls.length > 0 && (
                                            <div className="flex flex-wrap gap-2 mt-1">
                                                {chat.imageUrls.map((imgUrl: string, imgIndex: number) => (
                                                    <a
                                                        key={imgIndex}
                                                        href={`${window.location.origin}${imgUrl}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="block"
                                                    >
                                                        <img
                                                            src={`${window.location.origin}${imgUrl}`}
                                                            alt={`画像 ${imgIndex + 1}`}
                                                            className="w-24 h-24 object-cover rounded border border-[hsl(var(--border))] hover:opacity-80 transition-opacity"
                                                        />
                                                    </a>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex gap-0.5 flex-shrink-0">
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            className="h-6 w-6"
                                            onClick={() => setReplyingTo(chat.id)}
                                            title="返信"
                                        >
                                            <MessageCircle className="h-2.5 w-2.5" />
                                        </Button>
                                        {canEdit && (
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                className="h-6 w-6"
                                                onClick={() => {
                                                    if (window.confirm("このコメントを削除しますか？")) {
                                                        deleteChatMutation.mutate({ id: chat.id });
                                                    }
                                                }}
                                            >
                                                <Trash2 className="h-2.5 w-2.5" />
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="text-xs text-[hsl(var(--muted-foreground))] text-center py-2">
                                コメントはまだありません
                            </p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}


