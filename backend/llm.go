package main

import (
	"context"
	"fmt"

	"github.com/cloudwego/eino-ext/components/model/openai"
	"github.com/cloudwego/eino/components/model"
	"github.com/cloudwego/eino/schema"
)

type ChatService struct {
	chatModel model.ToolCallingChatModel
}

func NewChatService(ctx context.Context, cfg *Config) (*ChatService, error) {
	chatModel, err := openai.NewChatModel(ctx, &openai.ChatModelConfig{
		APIKey:          cfg.APIKey,
		Model:           cfg.ModelName,
		BaseURL:         cfg.BaseURL,
		ReasoningEffort: openai.ReasoningEffortLevelLow,
	})
	if err != nil {
		return nil, err
	}

	return &ChatService{
		chatModel: chatModel,
	}, nil
}

func (s *ChatService) CreateChatStream(ctx context.Context, inputMessages []MessagePayload) (*schema.StreamReader[*schema.Message], error) {
	var messages []*schema.Message

	messages = append(messages, &schema.Message{
		Role:    schema.System,
		Content: GetPrompt(),
	})

	for _, msg := range inputMessages {
		message, err := convertMessagePayload(msg)
		if err != nil {
			return nil, err
		}
		messages = append(messages, message)
	}

	return s.chatModel.Stream(ctx, messages)
}

func convertMessagePayload(msg MessagePayload) (*schema.Message, error) {
	message := &schema.Message{
		Role:    schema.RoleType(msg.Role),
		Content: msg.Content,
	}
	if msg.Image == "" {
		return message, nil
	}

	resizedImage, mimeType, err := ResizeImageToLimit(msg.Image)
	if err != nil {
		return nil, fmt.Errorf("process image message: %w", err)
	}

	imageURL := fmt.Sprintf("data:%s;base64,%s", mimeType, resizedImage)
	multiContent := make([]schema.MessageInputPart, 0, 2)
	if msg.Content != "" {
		multiContent = append(multiContent, schema.MessageInputPart{
			Type: schema.ChatMessagePartTypeText,
			Text: msg.Content,
		})
	}
	multiContent = append(multiContent, schema.MessageInputPart{
		Type: schema.ChatMessagePartTypeImageURL,
		Image: &schema.MessageInputImage{
			URL: &imageURL,
		},
	})

	message.Content = ""
	message.UserInputMultiContent = multiContent
	return message, nil
}
