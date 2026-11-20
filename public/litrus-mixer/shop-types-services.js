// Litrus service types and word banks: new booking and enquiry businesses, plus more lines for the built-in service types. Merged by public/litrus-mixer/index.html.
window.LITRUS_SHOP_TYPES = (window.LITRUS_SHOP_TYPES || []).concat([
  {
    id: 'nails-lashes', label: 'Nails, lashes & brows', offer: 'services',
    copy: {
      what: 'nail, lash and brow services',
      categories: ['Manicures', 'Pedicures', 'Lashes', 'Brows', 'Waxing', 'Packages'],
      heroTitle: ['Nails, Lashes And Brows', 'Polished Nails, Your Way', 'Little Details, Done Well', 'Your Next Nail Appointment', 'Lashes And Brows With Care', 'Treat Your Hands And Feet', 'Fresh Nails For Any Occasion', 'A Neat Look, Your Way'],
      heroSub: [
        'Browse nail, lash and brow services, then book a time that suits you.',
        'Choose the look you like and contact the studio to arrange your visit.',
        'From simple shapes to bold colours, explore the nail services listed here.',
        'Explore lash and brow services and ask about the look you have in mind.',
        'See the services on offer and send us a message to book your visit.',
        'Take a little time for yourself and choose the care you would like.'
      ],
      cta: ['Book A Visit', 'See Services', 'Book Your Nails', 'View Treatments', 'Contact The Studio', 'Choose A Service'],
      slogan: ['Little Details Matter', 'Neat Nails, Happy Hands', 'Lashes And Brows', 'Your Look, Your Way', 'Polished And Ready', 'Care In Every Detail'],
      promo: [
        'Explore nail, lash and brow services',
        'Book your next nail visit with us',
        'Ask about lash and brow services',
        'Choose a colour and book your visit',
        'Send us a message to book a time',
        'See the full list of studio services'
      ],
      aboutText: [
        'We offer nail, lash and brow services in a welcoming space. Browse what we do, choose what you like and contact us to book a time.',
        'From simple polish to lashes and brows, we take time over the small details. Look through our services and send us a message when you are ready to book.',
        'Our studio is a place to sit back while we look after your nails, lashes or brows. Explore the services listed here and ask us about anything you would like.'
      ],
      reviewLine: ['I left the studio feeling put together.', 'My nails looked neat and tidy.', 'They listened to what I wanted.', 'I liked how calm the visit felt.', 'My brows looked natural and neat.', 'Booking was simple and the visit was relaxed.', 'I will be back for my next set.']
    }
  },
  {
    id: 'spa-massage', label: 'Spa & massage', offer: 'services',
    copy: {
      what: 'spa and massage services',
      categories: ['Massage', 'Body Treatments', 'Facials', 'Sauna And Steam', 'Packages'],
      heroTitle: ['Time To Slow Down', 'Spa Time, Your Way', 'Massage And Body Care', 'Take A Quiet Moment', 'Make Time To Unwind', 'A Calm Place To Rest', 'Treat Yourself Today', 'Relax, Breathe, Unwind'],
      heroSub: [
        'Browse massage and spa treatments, then book a time that suits your day.',
        'Choose a treatment, sit back and let us look after the rest.',
        'Explore the spa services listed here and contact us to arrange your visit.',
        'Take a break from a busy week with a treatment you choose.',
        'Ask us about any treatment and we will help you choose.',
        'Plan some quiet time for yourself or a visit with a friend.'
      ],
      cta: ['Book A Treatment', 'See Treatments', 'Book Your Visit', 'Plan A Visit', 'Contact The Spa', 'View Packages'],
      slogan: ['Slow Down, Unwind', 'Calm Starts Here', 'Time For You', 'Rest And Recharge', 'A Quiet Escape', 'Unwind Your Way'],
      promo: [
        'Book a massage or spa treatment today',
        'Take some quiet time for yourself',
        'Explore massage and body treatments here',
        'Ask us about spa packages and visits',
        'Send us a message to book a treatment',
        'Plan a relaxing visit with a friend'
      ],
      aboutText: [
        'We offer massage, body treatments and spa services in a calm setting. Look through our treatments, choose what you would like and contact us to book a time.',
        'Our spa is a place to slow down and take a break from a busy day. Browse the services listed here and ask us anything before you book.',
        'Whether you want a short treatment or a longer visit, we will help you plan your time with us. Send us a message to arrange your visit.'
      ],
      reviewLine: ['A calm visit that I really enjoyed.', 'I left feeling relaxed and looked after.', 'The space was quiet and welcoming.', 'Booking my treatment was simple.', 'A lovely way to spend my afternoon.', 'I will be booking my next visit soon.']
    }
  },
  {
    id: 'fitness', label: 'Gym & fitness', offer: 'services',
    copy: {
      what: 'fitness and training sessions',
      categories: ['Classes', 'Personal Training', 'Yoga And Pilates', 'Group Sessions', 'Memberships'],
      heroTitle: ['Move Your Way', 'Training That Fits You', 'Find Your Next Class', 'Show Up For You', 'Train At Your Pace', 'Make Movement A Habit', 'Start Where You Are', 'Your Training, Your Way'],
      heroSub: [
        'Browse classes and training sessions, then book a time that suits your week.',
        'Explore the sessions on offer and contact us to ask which one suits you.',
        'Look through our classes and sessions and choose the one that fits your routine.',
        'Ask us about classes, personal sessions and how to get started.',
        'Find a session that fits your plans and come along when you are ready.',
        'Start at your own pace and build a routine you enjoy keeping.'
      ],
      cta: ['Book A Session', 'See Classes', 'Join A Class', 'View Sessions', 'Start Training', 'Ask About Sessions'],
      slogan: ['Keep Moving Forward', 'One Session At A Time', 'Good Habits, Good Days', 'Come As You Are', 'Move With Us', 'Every Step Counts'],
      promo: [
        'Book your next class or training session',
        'Ask us how to get started',
        'Explore classes and training sessions here',
        'Find a session that fits your week',
        'Send us a message to join a class',
        'Ask about group and personal sessions'
      ],
      aboutText: [
        'We run classes and training sessions for people who want to keep moving. Look through what we offer, choose a session and contact us to book your place.',
        'Whether you are just starting or already have a routine, we will help you find a session that suits you. Send us a message with any questions.',
        'Our sessions are about showing up and enjoying the time you spend training. Browse the classes listed here and book when you are ready.'
      ],
      reviewLine: ['The sessions are friendly and well planned.', 'I look forward to every class.', 'The coach explained each move clearly.', 'I felt welcome from my first visit.', 'Booking a class was simple.', 'A good place to keep my routine going.']
    }
  },
  {
    id: 'makeup-artist', label: 'Makeup artist', offer: 'services',
    copy: {
      what: 'makeup and beauty services',
      categories: ['Bridal Makeup', 'Event Makeup', 'Everyday Looks', 'Home Visits', 'Packages'],
      heroTitle: ['Makeup For Your Day', 'Look Ready For Anything', 'Bridal And Event Makeup', 'Your Look, Done With Care', 'Makeup That Feels Like You', 'Beauty For Big Days', 'Get Ready With Us', 'A Look You Will Love'],
      heroSub: [
        'Browse makeup services for weddings, events and everyday plans, then book your date.',
        'Tell us about your occasion and we will plan a look that suits you.',
        'Ask about home visits so you can get ready where you feel comfortable.',
        'From soft and simple to bold and bright, choose the look you want.',
        'Explore the services listed here and contact us to check your date.',
        'Get ready for your big day with makeup planned around you.'
      ],
      cta: ['Book Your Date', 'See Services', 'Book A Look', 'Check Availability', 'View Packages', 'Contact The Artist'],
      slogan: ['Your Look, Your Way', 'Ready For Your Day', 'Beauty With Care', 'Made For Big Days', 'Look And Feel Ready', 'Soft, Bold Or Simple'],
      promo: [
        'Book makeup for your next event',
        'Ask us about bridal makeup packages',
        'Check if your date is still open',
        'Ask about home visits for your makeup',
        'Plan your wedding day look with us',
        'Send us a message to book your date'
      ],
      aboutText: [
        'We offer makeup for weddings, events and everyday occasions. Tell us about your plans, choose a service and contact us to check that your date is open.',
        'Every look starts with a conversation about what you like. Browse our services and send us a message so we can plan your makeup together.',
        'Whether it is your wedding, a party or a photo shoot, we will help you get ready for it. Ask us about your date and where you would like to get ready.'
      ],
      reviewLine: ['My makeup looked lovely all day.', 'I felt like myself, only more polished.', 'They listened to what I wanted.', 'My bridal look was exactly what I hoped.', 'Getting ready felt calm and easy.', 'I would book them again for my next event.']
    }
  },
  {
    id: 'events', label: 'Events, décor & venues', offer: 'services',
    copy: {
      what: 'event planning and décor services',
      categories: ['Weddings', 'Parties', 'Corporate Events', 'Décor', 'Venues', 'Packages'],
      heroTitle: ['Events Planned With Care', 'Your Event, Your Way', 'Plan Your Next Celebration', 'Moments Worth Celebrating', 'From Idea To Event Day', 'Décor For Every Occasion', 'A Space For Your Event', 'Bring Your Event To Life'],
      heroSub: [
        'Tell us about your event and we will help you plan the details.',
        'Browse our planning, décor and venue services, then contact us to check your date.',
        'From weddings to birthdays and work events, explore what we can help with.',
        'Share your ideas with us and we will talk through the options together.',
        'Ask about décor, setup and the space you need for your guests.',
        'Plan your celebration with a team that listens to what you want.'
      ],
      cta: ['Plan Your Event', 'Check Your Date', 'See Services', 'Book A Consultation', 'View Packages', 'Contact Us'],
      slogan: ['Celebrate Your Way', 'Moments Made Together', 'Planned With Care', 'Your Day, Your Style', 'Ideas Brought To Life', 'Gather And Celebrate'],
      promo: [
        'Tell us about your next event',
        'Ask us about décor and setup',
        'Check if your event date is open',
        'Plan your wedding or party with us',
        'Send us your ideas and we will talk',
        'Explore our event and venue services'
      ],
      aboutText: [
        'We help people plan weddings, parties and work events. Tell us what you have in mind, browse our services and contact us to check that your date is open.',
        'Every event starts with a conversation about your ideas, your guests and the feel you want. We will talk through the options and help you plan the details.',
        'From décor and setup to the space itself, we look after the parts of your event that you choose. Send us a message to start planning.'
      ],
      reviewLine: ['Our guests loved how the room looked.', 'They listened to every idea we had.', 'The planning felt calm and well organised.', 'Everything was ready when our guests arrived.', 'I would plan my next event with them.', 'The décor matched what I pictured.']
    }
  },
  {
    id: 'catering', label: 'Catering & meal prep', offer: 'services',
    copy: {
      what: 'catering and event food',
      categories: ['Event Catering', 'Meal Prep', 'Platters', 'Weddings', 'Office Lunches'],
      heroTitle: ['Food For Your Event', 'Good Food, Well Served', 'Catering For Every Gathering', 'Meals Made For Sharing', 'Feed Your Guests Well', 'Meal Prep For Your Week', 'Plates For Every Occasion', 'Let Us Cook For You'],
      heroSub: [
        'Tell us about your event and we will plan a menu with you.',
        'Browse catering and meal prep options, then contact us to check your date.',
        'From family gatherings to work events, explore the food we can prepare.',
        'Ask about menus, guest numbers and anything your guests cannot eat.',
        'Ask about meal prep for your week and the dishes we make.',
        'Share your plans with us and we will suggest dishes to suit them.'
      ],
      cta: ['Plan Your Menu', 'Ask About Catering', 'See The Menu', 'Check Your Date', 'View Menus', 'Order Meal Prep'],
      slogan: ['Good Food, Shared', 'Cooked With Care', 'Food For Gatherings', 'Made For Sharing', 'From Our Kitchen', 'Plates Full Of Flavour'],
      promo: [
        'Plan the food for your next event',
        'Ask us about weekly meal prep',
        'Check if your catering date is open',
        'Tell us your plans and guest numbers',
        'Explore our catering and platter menus',
        'Ask about dishes for special diets'
      ],
      aboutText: [
        'We cook and serve food for weddings, parties, work events and family gatherings. Tell us about your plans and we will put together a menu that suits your guests.',
        'Whether you need food for an event or meals for the week, browse what we offer and send us a message to talk through your menu.',
        'Good food brings people together. We take care with every dish we prepare, and we are happy to talk through your ideas before you book.'
      ],
      reviewLine: ['Our guests kept asking who made the food.', 'The food was tasty and well presented.', 'They helped us plan a menu that worked.', 'Everything arrived on time and looked lovely.', 'My weekly meals have made life easier.', 'I would book them again for our next event.']
    }
  },
  {
    id: 'stays', label: 'Hotels, lodges & stays', offer: 'services',
    copy: {
      what: 'places to stay',
      categories: ['Rooms', 'Suites', 'Cottages', 'Family Stays', 'Long Stays'],
      heroTitle: ['A Place To Stay', 'Your Stay, Your Way', 'Rest, Relax And Stay', 'Find Your Room', 'A Quiet Place To Stay', 'Plan Your Next Stay', 'Your Home Away From Home', 'Stay A While'],
      heroSub: [
        'Browse our rooms and check availability for the dates you have in mind.',
        'Plan your trip, choose a room and contact us to book your stay.',
        'Explore the spaces we offer and ask us anything before you arrive.',
        'Whether for work, a holiday or a family visit, find a room that suits.',
        'Send us your dates and we will let you know what is open.',
        'Settle in, unwind and enjoy a comfortable stay with us.'
      ],
      cta: ['Book Your Stay', 'Check Availability', 'See Rooms', 'View Rooms', 'Send Your Dates', 'Plan Your Trip'],
      slogan: ['Stay A Little Longer', 'Rest Easy Here', 'Your Place To Stay', 'Come Stay With Us', 'Feel At Home', 'Arrive, Unwind, Stay'],
      promo: [
        'Send us your dates to check availability',
        'Plan your next stay with us',
        'Ask us about longer stays',
        'Explore our rooms and spaces here',
        'Book your room for the holidays',
        'Travelling as a family? Ask about rooms'
      ],
      aboutText: [
        'We offer a welcoming place to stay for travellers, families and visitors. Browse our rooms, check the details listed for each one and contact us to book your dates.',
        'Whether you are here for work, a holiday or time with family, we will help you find a room that suits your trip. Send us your dates to get started.',
        'Our aim is simple: a comfortable stay and a friendly welcome. Ask us anything about the rooms or the area before you book.'
      ],
      reviewLine: ['The room was clean and comfortable.', 'We felt welcome from the moment we arrived.', 'A quiet and restful place to stay.', 'Booking our stay was simple.', 'We would happily stay here again.', 'The hosts were kind and helpful.']
    }
  },
  {
    id: 'tours', label: 'Tours & safaris', offer: 'services',
    copy: {
      what: 'tours and travel experiences',
      categories: ['Day Trips', 'Safaris', 'Excursions', 'Group Tours', 'Private Tours'],
      heroTitle: ['Explore With Us', 'Your Next Adventure', 'Tours Worth Taking', 'Discover New Places', 'Trips Planned With Care', 'Go Somewhere New', 'Adventures Made Simple', 'Plan Your Next Trip'],
      heroSub: [
        'Browse our tours and trips, then contact us to check dates and places.',
        'Tell us where you would like to go and we will help you plan.',
        'From day trips to longer journeys, explore the experiences we offer.',
        'Ask about trips for families, friends and groups planning time away together.',
        'See the tours listed here and ask us anything before you book.',
        'Plan your trip with a team that knows the routes and the places.'
      ],
      cta: ['Book A Tour', 'See Tours', 'Plan Your Trip', 'View Trips', 'Check Dates', 'Enquire Now'],
      slogan: ['Explore More', 'Journeys To Remember', 'Go Further With Us', 'Travel Your Way', 'Adventure Awaits', 'See New Places'],
      promo: [
        'Ask us about our next group tour',
        'Plan your holiday trip with us',
        'Send us your dates and travel plans',
        'Explore day trips and longer tours',
        'Ask about private trips for your group',
        'Tell us where you would like to go'
      ],
      aboutText: [
        'We plan tours, trips and excursions for travellers who want to see new places. Browse our tours, choose one that suits you and contact us to check dates.',
        'Every trip starts with a chat about where you want to go and what you want to see. We will help you plan the details so you can enjoy the journey.',
        'Whether you are travelling alone, with family or with friends, we will help you find a tour that fits your plans. Send us a message to get started.'
      ],
      reviewLine: ['Our guide made the trip so enjoyable.', 'Everything was well planned from start to finish.', 'We saw places we will never forget.', 'Booking the tour was simple.', 'I would travel with them again.', 'The trip was even better than we hoped.']
    }
  },
  {
    id: 'property', label: 'Real estate & rentals', offer: 'services',
    copy: {
      what: 'property and rental services',
      categories: ['Homes For Rent', 'Homes To Buy', 'Land', 'Commercial Spaces', 'Property Management'],
      heroTitle: ['Find Your Next Home', 'A Place To Call Home', 'Homes, Land And Spaces', 'Property Made Simpler', 'Your Next Move Starts Here', 'Rent, Buy Or Let', 'Find The Right Space', 'Spaces For Living And Work'],
      heroSub: [
        'Browse homes, land and spaces, then contact us to arrange a viewing.',
        'Tell us what you are looking for and we will share options that fit.',
        'Explore the listings here and ask us about location, size and availability.',
        'Looking to let your property? Ask us how we can help you manage it.',
        'Find a place to rent or buy, with help at each step of the way.',
        'Send us a message to book a viewing at a time that suits you.'
      ],
      cta: ['See Listings', 'Book A Viewing', 'Find A Home', 'View Properties', 'List Your Property', 'Contact An Agent'],
      slogan: ['Find Your Place', 'Home Starts Here', 'Spaces That Fit', 'Your Next Move', 'Helping You Settle In', 'Property, Made Clear'],
      promo: [
        'Ask us about homes to rent',
        'Book a viewing for a listing you like',
        'Browse our latest homes and spaces',
        'Let your property with our help',
        'Tell us what kind of home you need',
        'Send us a message to arrange a viewing'
      ],
      aboutText: [
        'We help people find homes, land and spaces to rent or buy. Browse our listings, read the details for each one and contact us to arrange a viewing.',
        'Whether you are looking for a new home or need help letting your property, we will talk through your plans and help you with each step.',
        'Finding the right place takes time. Tell us what you need, where you would like to be and we will share options that suit you.'
      ],
      reviewLine: ['They helped us find a home we love.', 'Viewings were easy to arrange.', 'I felt listened to at every step.', 'They answered all my questions clearly.', 'Renting through them was simple.', 'I would recommend them to my friends.']
    }
  },
  {
    id: 'tattoo', label: 'Tattoo & piercing', offer: 'services',
    copy: {
      what: 'tattoo and piercing services',
      categories: ['Tattoos', 'Custom Designs', 'Piercings', 'Cover Ups', 'Consultations'],
      heroTitle: ['Art You Can Wear', 'Your Idea, Our Ink', 'Tattoos And Piercings', 'Custom Tattoo Designs', 'Start Your Next Piece', 'Wear Your Story', 'Made With Care', 'Book Your Next Session'],
      heroSub: [
        'Browse our tattoo and piercing services, then contact us to talk about your idea.',
        'Bring your idea and we will work on a design with you.',
        'Explore the styles we work in, then book a consultation when you are ready.',
        'Ask us about piercings, aftercare and anything you would like to know first.',
        'Every piece starts with a conversation about what you want to wear.',
        'Send us your idea, size and placement and we will talk it through.'
      ],
      cta: ['Book A Session', 'Share Your Idea', 'See Our Work', 'Book A Consultation', 'View Services', 'Ask About Piercings'],
      slogan: ['Art That Stays', 'Your Skin, Your Story', 'Ink With Intention', 'Ideas Made Permanent', 'Every Line Matters', 'Designed Around You'],
      promo: [
        'Send us your tattoo idea today',
        'Book a consultation for your next piece',
        'Ask us about piercing services',
        'Talk to us about a custom design',
        'Share your idea, size and placement',
        'Ask about aftercare before your visit'
      ],
      aboutText: [
        'We create tattoos and offer piercings in a friendly, welcoming studio. Share your idea with us, ask any questions and book a session when you feel ready.',
        'Every design starts with a conversation. Tell us what you have in mind, where you want it and how big, and we will work on it with you.',
        'Whether it is your first tattoo or your next piece, we take time to talk it through with you. Browse our services and send us a message to get started.'
      ],
      reviewLine: ['My tattoo came out just as I pictured.', 'They took time to explain everything.', 'I felt relaxed during my session.', 'The design was exactly what I wanted.', 'My piercing visit was calm and easy.', 'I will be back for my next piece.']
    }
  },

  // More lines for the built-in service types (ids already in index.html; these only add to their banks).
  {
    id: 'salon', offer: 'services',
    copy: {
      categories: [],
      heroTitle: ['Hair, Nails And More', 'Your Look, Freshly Done', 'Make Time For Yourself', 'Style That Suits You', 'Leave Feeling Refreshed'],
      heroSub: [
        'Book a time that suits you and let us take care of the rest.',
        'Tell us the look you want and we will talk it through with you.',
        'From a simple trim to a new style, see what the salon offers.',
        'Send us a message to ask about a service or book your visit.'
      ],
      cta: ['Book A Visit', 'See Treatments', 'Book Your Style'],
      slogan: ['Look Good, Feel Good', 'Style Made Simple', 'Time For You'],
      promo: ['Book your next salon visit with us', 'Ask us about a new style', 'Send us a message to book a time', 'Treat yourself to some salon time'],
      aboutText: [
        'Our salon is a friendly place to sit back while we take care of your hair, nails or skin. Browse our services and contact us to book a time that suits you.',
        'We take time to listen before we start, so we understand the look you want. Send us a message with any questions before booking.'
      ],
      reviewLine: ['I left the salon feeling refreshed.', 'They listened to what I wanted.', 'My hair looked great for days.', 'The visit was calm and friendly.', 'Booking a time was simple.', 'I will be back for my next visit.']
    }
  },
  {
    id: 'barber', offer: 'services',
    copy: {
      categories: [],
      heroTitle: ['Fresh Cuts, Clean Lines', 'Your Barber, Your Style', 'Sharp Looks Start Here', 'Time For A Fresh Cut', 'Grooming Done Right'],
      heroSub: [
        'Book a time that suits you and leave with a fresh look.',
        'Tell your barber the style you want and we will talk it through.',
        'From a quick trim to a beard tidy, see the services we offer.',
        'Send us a message to ask about a cut or book your visit.'
      ],
      cta: ['Book A Cut', 'See Services', 'Book Your Visit'],
      slogan: ['Sharp And Fresh', 'Clean Cuts, Good Vibes', 'Groomed Your Way'],
      promo: ['Book your next fresh cut with us', 'Ask about beard care and trims', 'Send us a message to book your chair', 'Bring a friend for a fresh cut'],
      aboutText: [
        'We are a friendly barber shop for cuts, trims and beard care. Browse our services, choose what you need and contact us to book a time that suits you.',
        'Every cut starts with a quick chat about the style you want. We take our time and keep the chair relaxed and friendly.'
      ],
      reviewLine: ['My fade came out clean and sharp.', 'The barber listened to what I wanted.', 'A relaxed shop with good conversation.', 'Booking a cut was simple.', 'My beard has never looked this neat.', 'I will be back for my next cut.']
    }
  },
  {
    id: 'repair', offer: 'services',
    copy: {
      categories: [],
      heroTitle: ['Fix It, Not Replace It', 'Repairs Done With Care', 'Bring Your Device Back', 'Help When Things Break', 'Repairs, Explained Simply'],
      heroSub: [
        'Tell us what is wrong and we will explain the options before we start.',
        'Bring your device in or send us a message to describe the problem.',
        'We check the problem first and talk you through the repair options.',
        'Ask us about phones, computers and other devices that need some care.'
      ],
      cta: ['Book A Repair', 'Describe The Problem', 'Ask About Repairs'],
      slogan: ['Fixed With Care', 'Repairs Without The Fuss', 'Clear Help, Honest Advice'],
      promo: ['Tell us what needs fixing today', 'Ask about repairs for your device', 'Send us a message about your repair', 'Bring your device in for a check'],
      aboutText: [
        'We repair and look after phones, computers and other everyday devices. Tell us what is wrong, and we will check it and explain your options before any work starts.',
        'Our aim is clear, simple help with your repair. Ask us about parts, timing and what to expect, and we will answer as honestly as we can.'
      ],
      reviewLine: ['They explained the problem clearly.', 'My phone works well again.', 'Honest advice and a tidy repair.', 'They kept me updated the whole time.', 'Dropping off my laptop was easy.', 'I will bring my next repair here.']
    }
  },
  {
    id: 'wellness', offer: 'services',
    copy: {
      categories: [],
      heroTitle: ['Make Space For You', 'Slow Down And Breathe', 'Wellness, Made Simple', 'A Calm Place For You', 'Your Time, Your Pace'],
      heroSub: [
        'Browse sessions and choose the one that fits your week and your pace.',
        'Tell us what you are looking for and we will help you choose.',
        'Book a time that suits you and take a break from a busy day.',
        'Send us a message to ask about a session before you book.'
      ],
      cta: ['Book A Session', 'See Sessions', 'Ask About Sessions'],
      slogan: ['Take A Breath', 'Your Time To Pause', 'Make Room For Rest'],
      promo: ['Book a session that fits your week', 'Take some time for yourself this week', 'Ask us which session suits you', 'Send us a message to book a time'],
      aboutText: [
        'We offer wellness sessions for people who want to make time for themselves. Browse what we offer, choose a session and contact us to book a time that suits you.',
        'We like to keep things relaxed and unhurried. Ask us anything about our sessions before you book, and we will help you find one that fits your routine.'
      ],
      reviewLine: ['A calm session that I really enjoyed.', 'I felt welcome from the start.', 'The space was peaceful and tidy.', 'Booking a session was simple.', 'I look forward to my weekly visit.', 'A good way to make time for myself.']
    }
  },
  {
    id: 'other-service', offer: 'services',
    copy: {
      categories: [],
      heroTitle: ['Help When You Need It', 'Services Made Simple', 'Let Us Help You', 'Tell Us What You Need', 'Clear, Friendly Service'],
      heroSub: [
        'Tell us what you need and we will explain how we can help.',
        'Browse our services, then contact us to talk through your plans.',
        'Send us a message and we will reply as soon as we can.',
        'Book a time to talk and ask any questions before you decide.'
      ],
      cta: ['Book A Visit', 'Send A Message', 'Ask A Question'],
      slogan: ['Help Made Simple', 'Ready To Listen', 'Your Plans, Our Help'],
      promo: ['Tell us what you need help with', 'Book a time to talk with us', 'Ask us about our services today', 'Send us a message to get started'],
      aboutText: [
        'We offer services for people and businesses who need a helping hand. Browse what we do, read the details and contact us to talk about what you need.',
        'Every job starts with listening. Tell us about your plans and we will explain what we can do, so you can decide what is right for you.'
      ],
      reviewLine: ['They listened and explained things clearly.', 'Easy to reach and quick to reply.', 'I felt looked after from start to finish.', 'The service was simple to book.', 'They were friendly and helpful throughout.', 'I would use their services again.']
    }
  }
]);
