import { Statistics } from '../models/index.js';

export const projects = async (req, res) => {
  try {
    const { dateRangeStart, dateRangeEnd } = req.query;

    const startDate = new Date(dateRangeStart);
    const endDate = new Date(dateRangeEnd);

    if (!dateRangeStart && !dateRangeEnd) {
      const result = await Statistics.getYtdProjectStatistics();

      res.json({
        data: result,
        success: true,
      });
    } else if (startDate && endDate) {
      const result = await Statistics.getDateRangeProjectStatistics(
        startDate,
        endDate,
      );

      res.json({
        data: result,
        success: true,
      });
    } else {
      throw new Error('invalid date information');
    }
  } catch (error) {
    res.status(400).json({
      message: error.message,
      success: false,
    });
  }
};

export const tonsCo2 = async (req, res) => {
  try {
    // Your actual logic to get the tonsCo2 data will go here.
    // This is an example placeholder.
    const placeholderTonsCo2 = 'This is your tonsCo2 data.';

    res.json({ tonsCo2: placeholderTonsCo2 });
  } catch (err) {
    res.status(500).json({
      message: 'Error retrieving Tons CO2 Data',
      error: err.message,
    });
  }
};

export const carbonByMethodology = async (req, res) => {
  try {
    // Your actual logic to get the carbonByMethodology data will go here.
    // This is an example placeholder.
    const placeholderCarbonByMethodology =
      'This is your carbonByMethodology data.';

    res.json({ carbonByMethodology: placeholderCarbonByMethodology });
  } catch (err) {
    res.status(500).json({
      message: 'Error retrieving Carbon by Methodology Data',
      error: err.message,
    });
  }
};
