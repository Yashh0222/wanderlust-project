(function () {
  const toggle = document.getElementById("chat-toggle");
  const panel = document.getElementById("chat-panel");
  const closeBtn = document.getElementById("chat-close");
  const form = document.getElementById("chat-form");
  const input = document.getElementById("chat-input");
  const messagesEl = document.getElementById("chat-messages");
  const sendBtn = document.getElementById("btn-send");
  const scrollableEl = document.getElementById("chat-scrollable");
  const pendingEl = document.getElementById("chat-pending");
  const pendingDetails = document.getElementById("pending-details");
  const btnConfirm = document.getElementById("btn-confirm");
  const btnCancel = document.getElementById("btn-cancel");

  const bookingFormEl = document.getElementById("chat-booking-form");
  const bookingListingEl = document.getElementById("booking-form-listing");
  const bookingCheckin = document.getElementById("booking-checkin");
  const bookingCheckout = document.getElementById("booking-checkout");
  const bookingGuests = document.getElementById("booking-guests");
  const btnBookingSubmit = document.getElementById("btn-booking-submit");

  if (!toggle) return;

  let threadId = localStorage.getItem("agent_thread_id") || "thread_" + Date.now();
  localStorage.setItem("agent_thread_id", threadId);
  let currentPendingBooking = null;

  function getTodayStr() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + day;
  }

  toggle.addEventListener("click", () => {
    panel.classList.toggle("chat-hidden");
    if (!panel.classList.contains("chat-hidden")) {
      input.focus();
    }
  });

  closeBtn.addEventListener("click", () => {
    panel.classList.add("chat-hidden");
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = input.value.trim();
    if (!msg) return;

    addMessage(msg, "user");
    input.value = "";
    sendBtn.disabled = true;

    const typingEl = addTyping();

    try {
      const res = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, threadId }),
      });

      const data = await res.json();

      removeTyping(typingEl);

      if (res.status === 401) {
        addMessage("Please log in to use the AI assistant.", "bot");
        return;
      }

      if (res.status === 429) {
        addMessage("I'm getting a lot of requests right now. Please wait a few seconds and try again.", "bot");
        return;
      }

      if (data.error) {
        addMessage(data.error, "bot");
      } else {
        threadId = data.threadId || threadId;
        localStorage.setItem("agent_thread_id", threadId);

        addMessage(data.reply, "bot");

        if (data.pendingBooking) {
          currentPendingBooking = data.pendingBooking;
          showPendingBooking(data.pendingBooking);
        } else if (data.bookingForm) {
          showBookingForm(data.bookingForm);
        } else if (data.navigation) {
          setTimeout(function () {
            window.location.href = data.navigation.url;
          }, 1200);
        }
      }
    } catch (err) {
      removeTyping(typingEl);
      addMessage("Network error. Please try again.", "bot");
    }

    sendBtn.disabled = false;
    input.focus();
  });

  btnConfirm.addEventListener("click", async () => {
    if (!currentPendingBooking) return;
    pendingEl.classList.add("chat-hidden");
    sendBtn.disabled = true;
    const typingEl = addTyping();

    try {
      const res = await fetch("/api/agent/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId, confirmed: true }),
      });

      const data = await res.json();
      removeTyping(typingEl);

      if (data.error) {
        addMessage(data.error, "bot");
      } else {
        addMessage(data.reply, "bot");
        threadId = data.threadId || threadId;
        localStorage.setItem("agent_thread_id", threadId);
      }
    } catch (err) {
      removeTyping(typingEl);
      addMessage("Network error. Please try again.", "bot");
    }

    currentPendingBooking = null;
    sendBtn.disabled = false;
  });

  btnCancel.addEventListener("click", async () => {
    if (!currentPendingBooking) return;
    pendingEl.classList.add("chat-hidden");
    sendBtn.disabled = true;
    const typingEl = addTyping();

    try {
      const res = await fetch("/api/agent/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId, confirmed: false }),
      });

      const data = await res.json();
      removeTyping(typingEl);

      if (data.error) {
        addMessage(data.error, "bot");
      } else {
        addMessage(data.reply, "bot");
        threadId = data.threadId || threadId;
        localStorage.setItem("agent_thread_id", threadId);
      }
    } catch (err) {
      removeTyping(typingEl);
      addMessage("Network error. Please try again.", "bot");
    }

    currentPendingBooking = null;
    sendBtn.disabled = false;
  });

  function getTomorrowStr() {
    var d = new Date();
    d.setDate(d.getDate() + 1);
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, "0");
    var day = String(d.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + day;
  }

  function showBookingForm(bf) {
    bookingListingEl.innerHTML =
      "<strong>" + escapeHtml(bf.listingTitle) + "</strong> &mdash; " +
      escapeHtml(bf.listingLocation) + "<br>" +
      "Rs." + bf.pricePerNight + "/night";

    var today = getTodayStr();
    var tomorrow = getTomorrowStr();
    bookingCheckin.value = "";
    bookingCheckin.min = today;
    bookingCheckout.value = "";
    bookingCheckout.min = tomorrow;
    bookingGuests.value = "2";

    bookingFormEl.classList.remove("chat-hidden");
    form.classList.add("chat-hidden");
    scrollToBottom();

    setTimeout(function () { bookingCheckin.focus(); }, 50);
  }

  function hideBookingForm() {
    bookingFormEl.classList.add("chat-hidden");
    form.classList.remove("chat-hidden");
    input.value = "";
    input.focus();
  }

  if (btnBookingSubmit) {
    btnBookingSubmit.addEventListener("click", async () => {
      var checkin = bookingCheckin.value.trim();
      var checkout = bookingCheckout.value.trim();
      var guests = bookingGuests.value;

      if (!checkin || !checkout) {
        addMessage("Please select both check-in and check-out dates.", "bot");
        return;
      }

      if (checkout <= checkin) {
        addMessage("Check-out date must be after check-in date.", "bot");
        return;
      }

      var msg = "Check-in: " + checkin + ", Check-out: " + checkout + ", Guests: " + guests;
      addMessage(msg, "user");
      hideBookingForm();

      sendBtn.disabled = true;
      var typingEl = addTyping();

      try {
        var res = await fetch("/api/agent/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: msg, threadId: threadId }),
        });

        var data = await res.json();
        removeTyping(typingEl);

        if (res.status === 401) {
          addMessage("Please log in to use the AI assistant.", "bot");
        } else if (res.status === 429) {
          addMessage("I'm getting a lot of requests right now. Please wait and try again.", "bot");
        } else if (data.error) {
          addMessage(data.error, "bot");
        } else {
          threadId = data.threadId || threadId;
          localStorage.setItem("agent_thread_id", threadId);
          addMessage(data.reply, "bot");

          if (data.pendingBooking) {
            currentPendingBooking = data.pendingBooking;
            showPendingBooking(data.pendingBooking);
          } else if (data.bookingForm) {
            showBookingForm(data.bookingForm);
          }
        }
      } catch (err) {
        removeTyping(typingEl);
        addMessage("Network error. Please try again.", "bot");
      }

      sendBtn.disabled = false;
    });
  }

  if (bookingCheckout) {
    bookingCheckout.addEventListener("change", function () {
      if (bookingCheckin.value && bookingCheckout.value <= bookingCheckin.value) {
        var nextDay = new Date(bookingCheckin.value);
        nextDay.setDate(nextDay.getDate() + 1);
        var y = nextDay.getFullYear();
        var m = String(nextDay.getMonth() + 1).padStart(2, "0");
        var d = String(nextDay.getDate()).padStart(2, "0");
        bookingCheckout.value = y + "-" + m + "-" + d;
      }
      if (bookingCheckin.value) {
        bookingCheckout.min = bookingCheckin.value;
      }
    });
  }

  if (bookingCheckin) {
    bookingCheckin.addEventListener("change", function () {
      if (bookingCheckin.value) {
        var nextDay = new Date(bookingCheckin.value);
        nextDay.setDate(nextDay.getDate() + 1);
        var y = nextDay.getFullYear();
        var m = String(nextDay.getMonth() + 1).padStart(2, "0");
        var d = String(nextDay.getDate()).padStart(2, "0");
        bookingCheckout.min = y + "-" + m + "-" + d;

        if (bookingCheckout.value && bookingCheckout.value <= bookingCheckin.value) {
          bookingCheckout.value = y + "-" + m + "-" + d;
        }
      }
    });
  }

  function scrollToBottom() {
    if (scrollableEl) scrollableEl.scrollTop = scrollableEl.scrollHeight;
  }

  function addMessage(text, sender) {
    var div = document.createElement("div");
    div.className = "chat-msg " + sender;
    var rendered = renderMarkdown(text || "");
    div.innerHTML = '<div class="chat-bubble">' + rendered + "</div>";
    messagesEl.appendChild(div);
    scrollToBottom();
  }

  function addTyping() {
    var div = document.createElement("div");
    div.className = "chat-msg bot";
    div.innerHTML = '<div class="chat-typing"><span></span><span></span><span></span></div>';
    messagesEl.appendChild(div);
    scrollToBottom();
    return div;
  }

  function removeTyping(el) {
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  function showPendingBooking(booking) {
    pendingDetails.innerHTML =
      "<strong>" + escapeHtml(booking.listingTitle) + "</strong><br>" +
      escapeHtml(booking.listingLocation) + "<br>" +
      "Check-in: " + booking.checkIn + "<br>" +
      "Check-out: " + booking.checkOut + "<br>" +
      "Guests: " + booking.guests + "<br>" +
      "Total: <strong>\u20B9" + booking.totalPrice + "</strong>";
    pendingEl.classList.remove("chat-hidden");
    scrollToBottom();
  }

  function renderMarkdown(str) {
    if (!str) return "";
    var safe = escapeHtml(str);
    safe = safe.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    safe = safe.replace(/\n/g, "<br>");
    return safe;
  }

  function escapeHtml(str) {
    if (!str) return "";
    var div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }
})();
