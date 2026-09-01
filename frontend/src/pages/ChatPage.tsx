import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Megaphone, MessageSquarePlus, NotebookPen, PhoneOff, Send, Users, Video } from 'lucide-react';
import { api } from '@/lib/api';
import { getChatSocket } from '@/lib/socket';
import { useAuth } from '@/lib/auth';
import { VideoCallOverlay } from '@/components/VideoCallOverlay';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import type { ChatThread, ChatThreadType, ChatMessage, StaffUser, ClassRecord, ChatCallStatus, JoinCallResponse } from '@/types';

const STAFF_PICKER_ROLES = ['DIRECTOR', 'ADMIN', 'PRINCIPAL', 'TEACHER'] as const;
const BROADCAST_ROLES = ['DIRECTOR', 'ADMIN', 'PRINCIPAL'] as const;
const MANAGE_ROLES = ['CHAIRMAN', 'DIRECTOR', 'ADMIN', 'PRINCIPAL', 'COORDINATOR'] as const;

function threadLabel(thread: ChatThread, myUserId?: string) {
  if (thread.title) return thread.title;
  if (thread.type === 'DIRECT') {
    const other = thread.members.find((m) => m.userId !== myUserId);
    return other?.user.fullName ?? 'Direct message';
  }
  return 'Conversation';
}

export default function ChatPage() {
  const { user, hasRole } = useAuth();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [liveMessages, setLiveMessages] = useState<ChatMessage[]>([]);
  const [activeCall, setActiveCall] = useState<JoinCallResponse | null>(null);
  const [withNotetaker, setWithNotetaker] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const canStartGroups = hasRole(...STAFF_PICKER_ROLES);

  const threadsQuery = useQuery({
    queryKey: ['chat-threads'],
    queryFn: () => api.get<ChatThread[]>('/chat/threads'),
    refetchInterval: 20000,
  });

  const callStatusQuery = useQuery({
    queryKey: ['chat-call-status', selectedId],
    queryFn: () => api.get<ChatCallStatus>(`/chat/threads/${selectedId}/call`),
    enabled: !!selectedId,
    refetchInterval: 8000,
  });

  const messagesQuery = useQuery({
    queryKey: ['chat-messages', selectedId],
    queryFn: () => api.get<ChatMessage[]>(`/chat/threads/${selectedId}/messages`),
    enabled: !!selectedId,
  });

  const selected = useMemo(() => threadsQuery.data?.find((t) => t.id === selectedId) ?? null, [threadsQuery.data, selectedId]);
  const isManager = hasRole(...MANAGE_ROLES);
  const canPost = !selected?.postingRestricted || selected?.myRole === 'MODERATOR' || isManager;

  const allMessages = useMemo(() => {
    const base = messagesQuery.data ?? [];
    const extra = liveMessages.filter((m) => m.threadId === selectedId && !base.some((b) => b.id === m.id));
    return [...base, ...extra];
  }, [messagesQuery.data, liveMessages, selectedId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [allMessages.length]);

  // One shared socket for the page: join/leave rooms as the selected thread
  // changes, and merge any incoming message into whichever thread it belongs
  // to (updates the sidebar preview even for threads you aren't viewing).
  useEffect(() => {
    const socket = getChatSocket();
    function onNewMessage(payload: { threadId: string; message: ChatMessage }) {
      setLiveMessages((prev) => [...prev, payload.message]);
      queryClient.invalidateQueries({ queryKey: ['chat-threads'] });
    }
    function onCallEvent(payload: { threadId: string }) {
      queryClient.invalidateQueries({ queryKey: ['chat-call-status', payload.threadId] });
    }
    socket.on('newMessage', onNewMessage);
    socket.on('callEvent', onCallEvent);
    return () => {
      socket.off('newMessage', onNewMessage);
      socket.off('callEvent', onCallEvent);
    };
  }, [queryClient]);

  useEffect(() => {
    if (!selectedId) return;
    const socket = getChatSocket();
    socket.emit('joinThread', { threadId: selectedId });
    api.patch(`/chat/threads/${selectedId}/read`).then(() => queryClient.invalidateQueries({ queryKey: ['chat-threads'] }));
    return () => {
      socket.emit('leaveThread', { threadId: selectedId });
    };
  }, [selectedId, queryClient]);

  const sendMutation = useMutation({
    mutationFn: (body: string) => api.post<ChatMessage>(`/chat/threads/${selectedId}/messages`, { body }),
    onSuccess: () => {
      setDraft('');
      queryClient.invalidateQueries({ queryKey: ['chat-messages', selectedId] });
      queryClient.invalidateQueries({ queryKey: ['chat-threads'] });
    },
  });

  function handleSend(e: FormEvent) {
    e.preventDefault();
    if (!draft.trim() || !selectedId) return;
    sendMutation.mutate(draft.trim());
  }

  const joinCallMutation = useMutation({
    mutationFn: () => api.post<JoinCallResponse>(`/chat/threads/${selectedId}/call/join`, { withNotetaker }),
    onSuccess: (data) => {
      setActiveCall(data);
      queryClient.invalidateQueries({ queryKey: ['chat-call-status', selectedId] });
    },
  });

  const endCallMutation = useMutation({
    mutationFn: () => api.post(`/chat/threads/${selectedId}/call/end`),
    onSuccess: () => {
      setActiveCall(null);
      queryClient.invalidateQueries({ queryKey: ['chat-call-status', selectedId] });
      queryClient.invalidateQueries({ queryKey: ['chat-messages', selectedId] });
    },
  });

  const call = callStatusQuery.data;
  const canEndCall = !!call && (isManager || selected?.myRole === 'MODERATOR' || call.startedBy.id === user?.userId);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Chat</h2>
          <p className="mt-1 text-sm text-muted-foreground">Class groups, direct messages, and school notices.</p>
        </div>
        {canStartGroups && (
          <Button onClick={() => setNewOpen(true)}>
            <MessageSquarePlus className="h-4 w-4" />
            New Conversation
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardContent className="max-h-[70vh] overflow-y-auto p-0">
            {threadsQuery.isLoading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : !threadsQuery.data?.length ? (
              <div className="flex flex-col items-center justify-center gap-2 py-14 text-center">
                <Users className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No conversations yet.</p>
              </div>
            ) : (
              threadsQuery.data.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSelectedId(t.id)}
                  className={`block w-full border-b border-border/60 px-4 py-3 text-left transition-colors hover:bg-muted/50 ${
                    selectedId === t.id ? 'bg-muted/70' : ''
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      {t.type === 'BROADCAST' && <Megaphone className="h-3.5 w-3.5 text-muted-foreground" />}
                      <p className="text-sm font-medium text-foreground">{threadLabel(t, user?.userId)}</p>
                    </div>
                    {!!t.unreadCount && <Badge variant="destructive">{t.unreadCount}</Badge>}
                  </div>
                  {t.lastMessage && (
                    <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                      {t.lastMessage.sender.fullName}: {t.lastMessage.body}
                    </p>
                  )}
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="flex flex-col lg:col-span-3">
          {!selected ? (
            <CardContent className="flex flex-1 flex-col items-center justify-center gap-2 py-20 text-center">
              <MessageSquarePlus className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Select a conversation to start chatting.</p>
            </CardContent>
          ) : (
            <>
              <div className="flex items-center justify-between border-b border-border px-5 py-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">{threadLabel(selected, user?.userId)}</p>
                  <p className="text-xs text-muted-foreground">
                    {selected.members.length} member{selected.members.length === 1 ? '' : 's'}
                    {call && <span className="ml-2 text-success">● Call in progress</span>}
                    {call?.notetakerJoined && (
                      <span className="ml-2 inline-flex items-center gap-1 text-muted-foreground">
                        <NotebookPen className="h-3 w-3" /> AI notetaker on
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2.5">
                  {!call && (
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <input type="checkbox" checked={withNotetaker} onChange={(e) => setWithNotetaker(e.target.checked)} />
                      Enable AI notetaker
                    </label>
                  )}
                  <Button variant={call ? 'default' : 'outline'} size="sm" loading={joinCallMutation.isPending} onClick={() => joinCallMutation.mutate()}>
                    <Video className="h-4 w-4" />
                    {call ? 'Join Call' : 'Start Call'}
                  </Button>
                  {canEndCall && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      loading={endCallMutation.isPending}
                      onClick={() => endCallMutation.mutate()}
                    >
                      <PhoneOff className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
              <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-5" style={{ maxHeight: '55vh', minHeight: '40vh' }}>
                {messagesQuery.isLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-10 w-2/3" />
                    ))}
                  </div>
                ) : (
                  allMessages.map((m) => {
                    const mine = m.senderId === user?.userId;
                    return (
                      <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[75%] rounded-lg px-3 py-2 ${mine ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                          {!mine && <p className="text-xs font-medium opacity-70">{m.sender.fullName}</p>}
                          <p className="text-sm">{m.body}</p>
                          <p className="mt-0.5 text-[10px] opacity-60">{new Date(m.createdAt).toLocaleTimeString()}</p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              <div className="border-t border-border p-3">
                {canPost ? (
                  <form onSubmit={handleSend} className="flex items-end gap-2">
                    <Textarea
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSend(e as unknown as FormEvent);
                        }
                      }}
                      rows={1}
                      placeholder="Type a message..."
                      className="flex-1 resize-none"
                    />
                    <Button type="submit" loading={sendMutation.isPending} disabled={!draft.trim()}>
                      <Send className="h-4 w-4" />
                    </Button>
                  </form>
                ) : (
                  <p className="text-center text-xs text-muted-foreground">Only moderators can post in this broadcast group.</p>
                )}
              </div>
            </>
          )}
        </Card>
      </div>

      {newOpen && (
        <NewConversationDialog
          open={newOpen}
          onOpenChange={setNewOpen}
          canBroadcast={hasRole(...BROADCAST_ROLES)}
          onCreated={(threadId) => {
            queryClient.invalidateQueries({ queryKey: ['chat-threads'] });
            setSelectedId(threadId);
          }}
        />
      )}

      {activeCall && (
        <VideoCallOverlay
          token={activeCall.token}
          serverUrl={activeCall.url}
          onDisconnected={() => {
            setActiveCall(null);
            queryClient.invalidateQueries({ queryKey: ['chat-call-status', selectedId] });
          }}
        />
      )}
    </div>
  );
}

function NewConversationDialog({
  open,
  onOpenChange,
  canBroadcast,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canBroadcast: boolean;
  onCreated: (threadId: string) => void;
}) {
  const { user } = useAuth();
  const [mode, setMode] = useState<'DIRECT' | 'CLASS' | ChatThreadType>('DIRECT');
  const [directUserId, setDirectUserId] = useState('');
  const [classId, setClassId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [title, setTitle] = useState('');
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const staffQuery = useQuery({ queryKey: ['staff-users'], queryFn: () => api.get<StaffUser[]>('/users'), enabled: open });
  const classesQuery = useQuery({
    queryKey: ['classes'],
    queryFn: () => api.get<ClassRecord[]>('/classes'),
    enabled: open && mode === 'CLASS',
  });
  const sectionsQuery = useQuery({
    queryKey: ['sections', classId],
    queryFn: () => api.get<{ id: string; name: string }[]>('/sections', { classId }),
    enabled: open && mode === 'CLASS' && !!classId,
  });

  const directMutation = useMutation({
    mutationFn: () => api.post(`/chat/threads/direct/${directUserId}`),
    onSuccess: (data: any) => {
      onCreated(data.id);
      onOpenChange(false);
    },
  });
  const sectionMutation = useMutation({
    mutationFn: () => api.post(`/chat/threads/section/${sectionId}`),
    onSuccess: (data: any) => {
      onCreated(data.id);
      onOpenChange(false);
    },
  });
  const groupMutation = useMutation({
    mutationFn: () =>
      api.post('/chat/threads', {
        schoolId: user?.schoolId,
        type: mode,
        title,
        memberIds,
      }),
    onSuccess: (data: any) => {
      onCreated(data.id);
      onOpenChange(false);
    },
    onError: (err: any) => setError(err?.body?.message ?? 'Something went wrong'),
  });

  function toggleMember(id: string) {
    setMemberIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (mode === 'DIRECT') {
      if (!directUserId) return setError('Please choose a person.');
      directMutation.mutate();
    } else if (mode === 'CLASS') {
      if (!sectionId) return setError('Please choose a class and section.');
      sectionMutation.mutate();
    } else {
      if (!title.trim()) return setError('Please give this group a name.');
      if (!memberIds.length) return setError('Please add at least one member.');
      groupMutation.mutate();
    }
  }

  const busy = directMutation.isPending || sectionMutation.isPending || groupMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>New Conversation</DialogTitle>
          <DialogDescription>Start a direct message, open a class group, or create a staff/broadcast group.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Select value={mode} onValueChange={(v) => setMode(v as typeof mode)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="DIRECT">Direct Message</SelectItem>
              <SelectItem value="CLASS">Class / Section Group</SelectItem>
              <SelectItem value="STAFF_GROUP">Staff Group</SelectItem>
              {canBroadcast && <SelectItem value="BROADCAST">Broadcast (whole group, staff-only posting)</SelectItem>}
            </SelectContent>
          </Select>

          {mode === 'DIRECT' && (
            <div>
              <Label className="mb-1.5 inline-block">Person</Label>
              <Select value={directUserId} onValueChange={setDirectUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a staff member" />
                </SelectTrigger>
                <SelectContent>
                  {(staffQuery.data ?? []).map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {mode === 'CLASS' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="mb-1.5 inline-block">Class</Label>
                <Select
                  value={classId}
                  onValueChange={(v) => {
                    setClassId(v);
                    setSectionId('');
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select class" />
                  </SelectTrigger>
                  <SelectContent>
                    {(classesQuery.data ?? []).map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-1.5 inline-block">Section</Label>
                <Select value={sectionId} onValueChange={setSectionId} disabled={!classId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select section" />
                  </SelectTrigger>
                  <SelectContent>
                    {(sectionsQuery.data ?? []).map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {(mode === 'STAFF_GROUP' || mode === 'BROADCAST') && (
            <>
              <div>
                <Label className="mb-1.5 inline-block">Group name</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Management Committee" />
              </div>
              <div>
                <Label className="mb-1.5 inline-block">Members</Label>
                <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
                  {(staffQuery.data ?? []).map((s) => (
                    <label key={s.id} className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-muted/50">
                      <input type="checkbox" checked={memberIds.includes(s.id)} onChange={() => toggleMember(s.id)} />
                      {s.fullName}
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}

          {error && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={busy}>
              Start
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
