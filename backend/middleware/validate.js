const { z } = require('zod');

const registerSchema = z.object({
  fullName: z.string().min(2).max(100),
  mobile: z.string().regex(/^\+?[1-9]\d{9,14}$/, 'Invalid mobile number'),
  password: z.string().min(6),
  dafaxbetId: z.string().min(3, 'Dafabet ID must be at least 3 characters'),
  securityPin: z.string().length(4, 'Security PIN must be exactly 4 digits').regex(/^\d{4}$/, 'Security PIN must be numeric'),
});

const loginSchema = z.object({
  mobile: z.string().regex(/^\+?[1-9]\d{9,14}$/, 'Invalid mobile number'),
  password: z.string().min(1),
});

const messageSchema = z.object({
  chatId: z.string(),
  content: z.string().optional(),
  type: z.enum(['text', 'image', 'audio', 'document', 'file', 'sticker', 'emoji', 'link']).optional(),
  isInternal: z.boolean().optional(),
}).refine(data => data.content || data.type !== 'text', {
  message: 'Content is required for text messages',
});

const leadStatusSchema = z.object({
  status: z.enum(['new', 'assigned', 'in_progress', 'follow_up', 'interested', 'converted', 'closed']),
});

const assignLeadSchema = z.object({
  agentId: z.string(),
});

const templateSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
  category: z.string().min(1),
  order: z.number().optional(),
});

const validate = (schema) => {
  return (req, res, next) => {
    try {
      schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation error',
          details: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      next(error);
    }
  };
};

module.exports = {
  validate,
  registerSchema,
  loginSchema,
  messageSchema,
  leadStatusSchema,
  assignLeadSchema,
  templateSchema,
};
