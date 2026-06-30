import { motion, AnimatePresence } from 'framer-motion';

const TypingIndicator = ({ typingUser }) => {
  return (
    <AnimatePresence>
      {typingUser && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.2 }}
          className="px-4 py-0.5"
        >
          <div className="flex justify-start">
            <div className="bg-bubble-customer border border-border rounded-[4px_20px_20px_20px] shadow-card px-4 py-3 max-w-[80%]">
              <div className="flex items-center gap-1.5">
                <motion.span
                  className="w-2 h-2 bg-text-3 rounded-full"
                  animate={{ y: [0, -4, 0] }}
                  transition={{ duration: 0.6, repeat: Infinity, delay: 0 }}
                />
                <motion.span
                  className="w-2 h-2 bg-text-3 rounded-full"
                  animate={{ y: [0, -4, 0] }}
                  transition={{ duration: 0.6, repeat: Infinity, delay: 0.15 }}
                />
                <motion.span
                  className="w-2 h-2 bg-text-3 rounded-full"
                  animate={{ y: [0, -4, 0] }}
                  transition={{ duration: 0.6, repeat: Infinity, delay: 0.3 }}
                />
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default TypingIndicator;
