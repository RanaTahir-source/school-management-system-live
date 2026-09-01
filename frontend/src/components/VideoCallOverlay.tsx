import { LiveKitRoom, VideoConference } from '@livekit/components-react';
import '@livekit/components-styles';
import { X } from 'lucide-react';

export function VideoCallOverlay({
  token,
  serverUrl,
  onDisconnected,
}: {
  token: string;
  serverUrl: string;
  onDisconnected: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[100] bg-black">
      <button
        onClick={onDisconnected}
        className="absolute right-4 top-4 z-10 rounded-full bg-black/50 p-2 text-white hover:bg-black/70"
        aria-label="Close call"
      >
        <X className="h-5 w-5" />
      </button>
      <LiveKitRoom
        token={token}
        serverUrl={serverUrl}
        connect
        video
        audio
        onDisconnected={onDisconnected}
        data-lk-theme="default"
        style={{ height: '100%' }}
      >
        <VideoConference />
      </LiveKitRoom>
    </div>
  );
}
