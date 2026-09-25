import { forwardRef } from 'react';
import { mediaUrl } from '../lib/media.js';

/** Renders a single story's media (photo, video or text-on-gradient). */
const StoryContent = forwardRef(function StoryContent({ story, muted, dataSaver, onVideoMeta }, videoRef) {
  if (!story) return null;
  if (story.type === 'video') {
    return (
      <video
        ref={videoRef}
        className="story-media"
        src={mediaUrl(story.mediaUrl)}
        muted={muted}
        playsInline
        autoPlay
        preload={dataSaver ? 'metadata' : 'auto'}
        onLoadedMetadata={(e) => onVideoMeta?.(e.currentTarget.duration)}
        data-testid="story-video"
      />
    );
  }
  if (story.type === 'image') {
    return (
      <div className="story-media-wrap" style={{ background: story.background }}>
        <img className="story-media" src={mediaUrl(story.mediaUrl)} alt={story.caption || 'Story'} draggable="false" />
        {story.caption && <p className="story-caption">{story.caption}</p>}
      </div>
    );
  }
  return (
    <div className="story-text" style={{ background: story.background }} data-testid="story-text">
      <p>{story.text}</p>
      {story.caption && <p className="story-caption">{story.caption}</p>}
    </div>
  );
});

export default StoryContent;
