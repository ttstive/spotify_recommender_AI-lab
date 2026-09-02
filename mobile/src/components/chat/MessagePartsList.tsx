import { StyleSheet, View } from 'react-native';

import { BasicMarkdown, StreamingCursor } from '@kesha-antonov/react-native-chat';

import type { ChatMessage } from '../../opencode/mapToChatMessage';
import { useColors } from '../../theme/colors';
import { FileChip } from './FileChip';
import { parsePlaylistResult, RecommendationResultCard } from './RecommendationResultCard';
import { ReasoningAccordion } from './ReasoningAccordion';
import { ToolCallCard } from './ToolCallCard';

// OpenCode may surface an MCP tool's name prefixed with its server name
// (e.g. "music_recommender_recommender_create_playlist") rather than the bare
// tool name -- matching on a suffix is resilient to either form.
function isPlaylistTool(toolName: string): boolean {
  return toolName.endsWith('recommender_create_playlist');
}

function isGenerating(message: ChatMessage): boolean {
  const starts = message.parts.filter((p) => p.type === 'step-start').length;
  const finishes = message.parts.filter((p) => p.type === 'step-finish').length;
  return starts > finishes;
}

export function MessagePartsList({ message, position }: { message: ChatMessage; position: 'left' | 'right' }) {
  const colors = useColors();
  const textColor = position === 'right' ? '#FFFFFF' : colors.text;
  const renderable = message.parts.filter((p) => p.type !== 'step-start' && p.type !== 'step-finish');
  const lastTextIndex = [...renderable].map((p) => p.type).lastIndexOf('text');
  const streaming = isGenerating(message);

  if (renderable.length === 0) {
    return streaming ? (
      <View style={styles.emptyStreaming}>
        <StreamingCursor style={{ color: textColor }} />
      </View>
    ) : null;
  }

  return (
    <View style={styles.container}>
      {renderable.map((part, index) => {
        const key = part.id ?? `${message._id}-${index}`;
        switch (part.type) {
          case 'text':
            return (
              <View key={key}>
                <BasicMarkdown text={part.text} textStyle={{ color: textColor }} />
                {streaming && index === lastTextIndex && <StreamingCursor style={{ color: textColor }} />}
              </View>
            );
          case 'reasoning':
            return <ReasoningAccordion key={key} text={part.text} />;
          case 'tool': {
            if (part.state.status === 'completed' && part.state.output && isPlaylistTool(part.tool)) {
              const result = parsePlaylistResult(part.state.output);
              if (result) return <RecommendationResultCard key={key} result={result} />;
            }
            return <ToolCallCard key={key} part={part} />;
          }
          case 'file':
            return <FileChip key={key} part={part} />;
          default:
            return null;
        }
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 2,
  },
  emptyStreaming: {
    paddingVertical: 2,
  },
});
