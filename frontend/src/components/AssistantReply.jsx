import { parseAssistantReply } from './assistantReplyFormat';

function ReplyText({ text }) {
  return text
    .split(/(\*\*[^*\n]+\*\*)/g)
    .map((part, index) =>
      /^\*\*[^*\n]+\*\*$/.test(part) ? <strong key={index}>{part.slice(2, -2)}</strong> : part
    );
}

export default function AssistantReply({ content }) {
  return (
    <div className="track-guide-reply">
      {parseAssistantReply(content).map((block, index) => {
        if (block.type === 'paragraph') {
          return (
            <p key={index}>
              <ReplyText text={block.text} />
            </p>
          );
        }
        const List = block.type === 'ordered' ? 'ol' : 'ul';
        return (
          <List key={index} start={block.start} role="list" className="track-guide-reply-list">
            {block.items.map((item, itemIndex) => (
              <li key={itemIndex}>
                <ReplyText text={item} />
              </li>
            ))}
          </List>
        );
      })}
    </div>
  );
}
