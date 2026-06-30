const DateSeparator = ({ date }) => {
  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    }
    if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }

    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="flex items-center justify-center py-2">
      <div className="px-2.5 py-0.5 bg-bg rounded-full">
        <span className="text-[10px] font-medium text-text-3">
          {formatDate(date)}
        </span>
      </div>
    </div>
  );
};

export default DateSeparator;
