import { StyleSheet, View } from 'react-native';

import { BasicMarkdown, StreamingCursor } from '@kesha-antonov/react-native-chat';

import type { ChatMessage } from '../../opencode/mapToChatMessage';
import { useColors } from '../../theme/colors';
import { parsePlaylistResult, RecommendationResultCard } from './RecommendationResultCard';

function isPlaylistTool(toolName: string): boolean {
  return toolName.endsWith('recommender_create_playlist');
}

function isGenerating(message: ChatMessage): boolean {
  const starts = message.parts.filter((part) => part.type === 'step-start').length;
  const finishes = message.parts.filter((part) => part.type === 'step-finish').length;
  return starts > finishes;
}

export function MessagePartsList({ message, position }: { message: ChatMessage; position: 'left' | 'right' }) {
  const colors = useColors();
  const textColor = position === 'right' ? '#07150B' : colors.text;
  const playlistPart = message.parts.find(
    (part) => part.type === 'tool'
      && part.state.status === 'completed'
      && part.state.output
      && isPlaylistTool(part.tool)
      && parsePlaylistResult(part.state.output),
  );
  const renderable = playlistPart ? [playlistPart] : message.parts.filter((part) => part.type === 'text' && part.text.trim());
  const lastTextIndex = [...renderable].map((part) => part.type).lastIndexOf('text');
  const streaming = isGenerating(message);

  if (renderable.length === 0) {
    return streaming ? <StreamingCursor style={{ color: textColor }} /> : null;
  }

  return (
    <View style={styles.container}>
      {renderable.map((part, index) => {
        const key = part.id ?? `${message._id}-${index}`;
        if (part.type === 'text') {
          return (
            <View key={key}>
              <BasicMarkdown text={part.text} textStyle={{ color: textColor }} />
              {streaming && index === lastTextIndex && <StreamingCursor style={{ color: textColor }} />}
            </View>
          );
        }
        if (part.type === 'tool' && part.state.status === 'completed' && part.state.output) {
          const result = parsePlaylistResult(part.state.output);
          return result ? <RecommendationResultCard key={key} result={result} /> : null;
        }
        return null;
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 2 },
});
